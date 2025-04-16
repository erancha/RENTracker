const { Pool } = require('pg');
const { logMiddleware } = require('./utils');

const pgPoolParams = {
  host: process.env.RDS_ENDPOINT,
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false, // TODO: Handle SSL before production!
  },
};
const pgPool = new Pool(pgPoolParams);

// Check the health of the database
const healthCheck = logMiddleware('healthCheck')(async () => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const now = await pgClient.query('SELECT NOW()');
    return now.rows[0].now;
  } catch (error) {
    console.error('Health check failed', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Internal implementation of upsertUser for PostgreSQL
const upsertUser = logMiddleware('pg_upsertUser')(async (userId, userName, email, phoneNumber, saasTenantId) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      `WITH operation AS (
        INSERT INTO users (user_id, user_name, email_address, phone_number, tenant_id) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE 
        SET user_name = $2, email_address = $3, phone_number = $4, tenant_id = $5
        RETURNING user_id, user_name, email_address, phone_number, tenant_id,
          (xmax = 0) as is_insert
      )
      SELECT *, 
        CASE WHEN is_insert THEN 'created' ELSE 'updated' END as operation
      FROM operation`,
      [userId, userName, email, phoneNumber || '', saasTenantId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in pg_upsertUser:', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Internal implementation of getAllUsers for PostgreSQL
const getAllUsers = logMiddleware('pg_getAllUsers')(async (saasTenantId) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      `SELECT user_id, user_name, email_address, is_disabled, created_at
       FROM users 
       WHERE tenant_id = $1 
       ORDER BY user_name`,
      [saasTenantId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error in pg_getAllUsers:', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Dispose the database client
const disposeClient = async () => {
  await pgPool.end();
};

// Create an apartment
const createApartment = logMiddleware('createApartment')(async (apartment_id, initialBalance, user_id, tenant_id) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      `
      INSERT INTO apartments (apartment_id, balance, user_id, tenant_id, is_disabled) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (apartment_id, tenant_id) DO NOTHING 
      RETURNING *`,
      [apartment_id, initialBalance, user_id, tenant_id, true]
    );
    return result.rows[0] || undefined;
  } catch (error) {
    console.error('Error creating apartment', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Updates an apartment's details
const updateApartment = logMiddleware('updateApartment')(async (apartment_id, address, unit_number, rent_amount, is_disabled, tenant_id) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const query = `
      UPDATE apartments 
      SET address = $1, unit_number = $2, rent_amount = $3, is_disabled = $4
      WHERE apartment_id = $5 AND tenant_id = $6
      RETURNING apartment_id, user_id, address, unit_number, rent_amount, is_disabled
    `;
    const values = [address, unit_number, rent_amount, is_disabled, apartment_id, tenant_id];
    const result = await pgClient.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error in updateApartment:', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Delete an apartment
const deleteApartment = logMiddleware('deleteApartment')(async (apartment_id, tenant_id) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      `
      DELETE FROM apartments 
      WHERE apartment_id = $1 AND tenant_id = $2 
      RETURNING apartment_id,user_id`,
      [apartment_id, tenant_id]
    );

    if (result.rowCount === 0) throw new Error('Apartment not found');

    return result.rows[0];
  } catch (error) {
    console.error('Error deleting apartment', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Get all apartments
const getAllApartments = logMiddleware('getAllApartments')(async (tenant_id) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      `SELECT a.apartment_id, a.user_id, u.user_name, a.balance, a.is_disabled, a.created_at, a.updated_at 
       FROM apartments a 
       JOIN users u ON a.user_id = u.user_id 
       WHERE a.tenant_id = $1 
       ORDER BY a.updated_at DESC`,
      [tenant_id]
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getAllApartments:', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// Get all activity for an apartment
const getApartmentActivity = logMiddleware('getApartmentActivity')(async (apartment_id, tenant_id) => {
  let pgClient;
  try {
    pgClient = await pgPool.connect();
    const result = await pgClient.query(
      'SELECT id,created_at,activity FROM apartmentActivity WHERE apartment_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [apartment_id, tenant_id]
    );

    return result.rows.map((row) => {
      const decryptedActivity = row.activity;
      const activityObject = JSON.parse(decryptedActivity);
      return {
        id: row.id,
        created_at: row.created_at,
        ...activityObject,
      };
    });
  } catch (error) {
    console.error('Error getting activity', error);
    throw error;
  } finally {
    if (pgClient) pgClient.release();
  }
});

// SQS - queueing saved activity data
const sqsClient = new SQSClient({ region: process.env.APP_AWS_REGION });

async function enqueueSavedActivity(messageBody) {
  const EXECUTED_APARTMENT_ACTIVITY_QUEUE_URL = process.env.EXECUTED_APARTMENT_ACTIVITY_QUEUE_URL;
  try {
    const data = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: EXECUTED_APARTMENT_ACTIVITY_QUEUE_URL,
        MessageGroupId: 'Default',
        MessageBody: JSON.stringify({ ...messageBody, timeStamp: new Date().toISOString() }),
      })
    );
    return data;
  } catch (error) {
    console.error(`Error sending message to SQS queue ${EXECUTED_APARTMENT_ACTIVITY_QUEUE_URL}:`, error);
    throw error;
  }
}

module.exports = {
  healthCheck,
  upsertUser,
  getAllUsers,
  createApartment,
  updateApartment,
  deleteApartment,
  getAllApartments,
  disposeClient,
  cache: {
    getApartmentActivity,
  },
};
