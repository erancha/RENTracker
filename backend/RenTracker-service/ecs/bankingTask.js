const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { CURRENT_TASK_ID } = require('./constants');
const { onWebsocketConnect } = require('./websocketHandlers');
const dbData = require('./layers/dbData/dbData');
const { testRedisConnectivity, disposeRedisClient } = require('./layers/redisClient/redisClient');

const app = express();
const httpServer = http.createServer(app);
const SERVER_PORT = process.env.SERVER_PORT || 4000;
httpServer.listen(SERVER_PORT, () => console.log(`RentTracking service is running on port ${SERVER_PORT}`));

// Enable the parsing of incoming JSON payloads in HTTP requests
app.use(express.json());

// Enable CORS for all routes
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Integrate WebSocket server with HTTP server to handle upgrade requests:
// 1. Client sends an HTTP request with 'Upgrade' headers for WebSocket.
// 2. HTTP server identifies and processes this request.
// 3. WebSocket server takes over the connection for real-time communication.
const websocketServer = new WebSocket.Server({ server: httpServer });
websocketServer.on('connection', onWebsocketConnect);

// Middleware to log elapsed time, query string, and post body if present
const logElapsedTime = (req, res, next) => {
  const startTime = Date.now();

  // Capture query string
  const queryString = Object.keys(req.query).length ? JSON.stringify(req.query) : null;

  // Capture the original res.status function
  const originalStatus = res.status;
  res.status = function (code) {
    if (code >= 400) {
      const error = req.error || new Error(`HTTP ${code}`);
      console.error(`Task ${CURRENT_TASK_ID}: Error in ${req.method} ${req.path}:`, error);
    }
    return originalStatus.apply(this, arguments);
  };

  // Log the request when it's finished
  res.on('finish', () => {
    const elapsedTime = Date.now() - startTime;
    let logMessage = `Task ${CURRENT_TASK_ID}: Elapsed time for ${req.method} ${req.path}: ${elapsedTime.toLocaleString()} ms`;
    if (queryString) logMessage += ` | Query String: ${queryString}`;
    console.log(logMessage);

    // Log the POST body if it's a POST request
    if (req.method === 'POST' && req.body) console.log(`POST Body: ${JSON.stringify(req.body)}`);
  });

  next();
};
app.use(logElapsedTime);

//=========================================================================================================================
// HTTP
//=========================================================================================================================

// RentTracking routes should be prefixed with /api/crud
const crudRouter = express.Router();
app.use('/api/crud', crudRouter);

// Health check endpoint
crudRouter.get('/health', async (req, res) => {
  try {
    const now = await dbData.healthCheck();
    let keysCount = null;

    if (req.query.redis === 'true') keysCount = await testRedisConnectivity();

    res.status(200).json({ status: `healthy ; PG: ${now}` + (keysCount !== null ? ` ; Redis: ${keysCount} keys.` : '') });
  } catch (error) {
    req.error = error;
    res.status(500).json({ status: 'ERROR', message: 'Connection error(s)' });
  }
});

// Create a user
crudRouter.post('/user', async (req, res) => {
  const { userId, userName, email, phoneNumber } = req.body;
  if (!userId || !userName || !email) return res.status(400).json({ message: 'User ID, User Name, and Email are required' });

  try {
    // Insert the user (if not already inserted). // LandlordsTable and TenantsTable serve no purpose in the current stack-per-landlord model ..
    //     const result = await dbData.upsertUser(userId, userName, email, phoneNumber, process.env.SAAS_TENANT_ID);
    res.status(201).json({
      // message: `User ${result.operation} successfully`,
      // payload: result,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Get all users
crudRouter.get('/users', async (req, res) => {
  try {
    const users = await dbData.getAllUsers(process.env.SAAS_TENANT_ID);
    res.json({ status: 'OK', users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ status: 'ERROR', message: 'Failed to retrieve users' });
  }
});

// Create an apartment
crudRouter.post('/apartment', async (req, res) => {
  const { apartmentId, initialBalance = 0, userId } = req.body;
  if (!apartmentId || !userId) return res.status(400).json({ message: 'Apartment ID and User ID are required' });

  try {
    const result = await dbData.createApartment(apartmentId, initialBalance, userId, process.env.SAAS_TENANT_ID);
    if (!result) return res.status(409).json({ message: 'Apartment already exists' });

    // Enable the apartment after creation
    await dbData.updateApartment(apartmentId, false, process.env.SAAS_TENANT_ID);

    res.status(201).json({
      message: 'Apartment created successfully',
      payload: { ...result, is_disabled: false },
    });
  } catch (error) {
    req.error = error;
    res.status(500).json({ message: 'Error creating apartment' });
  }
});

// Get all apartments
crudRouter.get('/apartments', async (req, res) => {
  try {
    const result = await dbData.getAllApartments(process.env.SAAS_TENANT_ID);
    if (result.length === 0) return res.status(404).json({ message: 'No apartments found' });
    res.json({
      message: 'Apartments retrieved successfully',
      payload: result,
    });
  } catch (error) {
    req.error = error;
    res.status(500).json({ message: 'Error retrieving apartments' });
  }
});

// Get apartments by user ID
crudRouter.get('/apartments/user', async (req, res) => {
  const { userId } = req.query;

  try {
    const apartments = await dbData.getApartmentsOfLandlord(userId, process.env.SAAS_TENANT_ID);
    res.json({
      message: 'Apartments retrieved successfully',
      payload: apartments,
    });
  } catch (error) {
    console.error('Error retrieving apartments by user ID:', error);
    res.status(500).json({ message: 'Error retrieving apartments' });
  }
});

// Get apartment balance
crudRouter.get('/balance/:apartmentId', async (req, res) => {
  const { apartmentId } = req.params;
  if (!apartmentId) return res.status(400).json({ message: 'Apartment ID is required' });

  try {
    const { balance, apartmentFound } = await dbData.getApartmentBalance(process.env.SAAS_TENANT_ID, apartmentId);
    if (!apartmentFound) return res.status(404).json({ message: 'Apartment not found' });
    res.json({
      message: 'Balance retrieved successfully',
      payload: { apartmentId, balance },
    });
  } catch (error) {
    req.error = error;
    res.status(500).json({ message: 'Error retrieving balance' });
  }
});

// Get all activity for an apartment
crudRouter.get('/activity/:apartmentId', async (req, res) => {
  const { apartmentId } = req.params;

  if (!apartmentId) return res.status(400).json({ message: 'Apartment ID is required' });

  try {
    const activity = await dbData.cache.getApartmentActivity({ apartment_id: apartmentId, saas_tenant_id: process.env.SAAS_TENANT_ID });
    res.json({
      message: 'Activity retrieved successfully',
      payload: activity,
    });
  } catch (error) {
    req.error = error;
    res.status(500).json({ message: 'Error retrieving activity' });
  }
});

// Handle 404 for all other paths (not found)
app.use((req, res) => {
  console.error({ req, message: 'Path not found' });
  res.status(404).json({ message: 'Path not found' });
});

const cleanup = async () => {
  await disposeRedisClient();
  await dbData.disposeClient();
  console.log(`Task ${CURRENT_TASK_ID}: Closed PostgreSQL and Redis pools.`);
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
