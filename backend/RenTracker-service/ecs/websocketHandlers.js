const url = require('url');
const jwt = require('jsonwebtoken');
const { CURRENT_TASK_ID } = require('./constants');
const { getRedisClient, getPublisherClient, getSubscriberClient } = require('./layers/redisClient/redisClient');
const { handleCommand, handleRead, determineTargetUsers, setTaskId } = require('./layers/commandsHandlers/commandsHandlers');
const dbData = require('./layers/dbData/dbData');

setTaskId(CURRENT_TASK_ID);

// Refer to ./websockets-ecs.png
// -----------------------------
const CONNECTED_USERS_TO_TASKS_IDS_MAP = `${process.env.STACK_NAME}:UsersToTasksIdsMap()`;
const CONNECTED_USERS_IDS_TO_NAMES_MAP = `${process.env.STACK_NAME}:UsersIdsToNamesMap()`;

// WebSocket clients connected to this task instance: userId --> socket
const userIdSocketMap = new Map();

// Initialize Redis pub/sub clients, and Subscribe to this task's channel:
const publisher = getPublisherClient();
const subscriber = getSubscriberClient();
subscriber.subscribe(`task:${CURRENT_TASK_ID}`);
subscriber.on('message', onRedisPubSubMessage);

/*
  on new connection from a websocket client:
 */
const onWebsocketConnect = async (socket, request) => {
  const queryParams = url.parse(request.url, true).query;

  const decodedJwt = jwt.decode(queryParams.token);
  validateJWT(decodedJwt);

  const currentUserId = decodedJwt.sub ?? decodedJwt.identities.userId;
  const currentUserName = decodedJwt.name;
  const currentUserEmail = decodedJwt.email;
  const currentUserPhoneNumber = decodedJwt.phone_number;

  await dbData.upsertUser(currentUserId, currentUserName, currentUserEmail, currentUserPhoneNumber, process.env.SAAS_TENANT_ID);

  socket.userId = currentUserId;
  userIdSocketMap.set(currentUserId, socket);

  const redisClient = getRedisClient();
  await redisClient.hset(CONNECTED_USERS_TO_TASKS_IDS_MAP, currentUserId, CURRENT_TASK_ID);
  await redisClient.hset(CONNECTED_USERS_IDS_TO_NAMES_MAP, currentUserId, currentUserName);

  console.log(`Task ${CURRENT_TASK_ID}: User ${socket.userId} connected and inserted to ${CONNECTED_USERS_TO_TASKS_IDS_MAP}.`);
  console.log(`Task ${CURRENT_TASK_ID}: User ${socket.userId} connected and inserted to ${CONNECTED_USERS_IDS_TO_NAMES_MAP}.`);

  try {
    const isLandlord = isAdminUser(currentUserId);
    // const connectionsAndUsernames = await getConnectionsAndUsernames();
    const response = {
      ...(await handleRead({
        commandParams: {
          apartments: { all: isLandlord },
          payments: { fromFirstApartment: true },
        },
        connectedUserId: currentUserId,
      })),
      ...(isLandlord ? { isLandlord } : {}),
      // connectionsAndUsernames,
    };
    writeResponse({ response, responseSocket: socket });

    // Broadcast the updated connections list to all other users
    // await broadcastConnectionsUpdate(connectionsAndUsernames, socket.userId);
  } catch (error) {
    socket.send(JSON.stringify({ message: 'Failed to read data for a new client:', error }));
  }

  // Websocket event handlers
  socket.on('message', (message) => onWebsocketMessage(message, socket));
  socket.on('close', () => onWebsocketDisconnect(socket));
};

/*
  Validate a JWT
 */
const validateJWT = (decodedJwt) => {
  if (!decodedJwt || (!decodedJwt.sub && !decodedJwt.identities.userId))
    throw new Error(`Invalid token: Missing userId: ${JSON.stringify(decodedJwt, null, 2)}`);

  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  if (decodedJwt.exp < currentTimeInSeconds) {
    throw new Error(`Token has expired ${currentTimeInSeconds - decodedJwt.exp} seconds ago`);
  }
};

/*
  on message from a connected websocket client:
 */
const onWebsocketMessage = async (message, socket) => {
  try {
    const redisClient = getRedisClient();
    const username = await redisClient.hget(CONNECTED_USERS_IDS_TO_NAMES_MAP, socket.userId);
    console.log(`Task ${CURRENT_TASK_ID}: Received ${message}, from user ${socket.userId}: ${username}`);

    // Execute command locally
    console.log(`Task ${CURRENT_TASK_ID}: Handling ${message} locally ...`);
    const { type: commandType, params: commandParams } = JSON.parse(message).command;
    await handleCommandWithNotifications({ commandType, commandParams, connectedUserId: socket.userId });
  } catch (error) {
    console.error(`Task ${CURRENT_TASK_ID}: Error handling websocket message:`, error);
    socket.send(JSON.stringify({ error: error.message }));
  }
};

// Handle command and send notifications
const handleCommandWithNotifications = async ({ commandType, commandParams, connectedUserId }) => {
  const response = await handleCommand({ commandType, commandParams, connectedUserId });

  const targetUserIds = determineTargetUsers({ commandType, commandParams, response, connectedUserId });
  if (targetUserIds.length > 0) {
    console.log(`Task ${CURRENT_TASK_ID}: Notification target user IDs: ${targetUserIds.join(', ')}`);
    const notificationMessage = {
      type: 'notification',
      commandType,
      response,
    };

    try {
      const redisClient = getRedisClient();
      for (const targetUserId of targetUserIds) {
        const targetTaskId = await redisClient.hget(CONNECTED_USERS_TO_TASKS_IDS_MAP, targetUserId);
        if (targetTaskId === CURRENT_TASK_ID) {
          // Write to the response socket in the current task:
          const responseSocket = userIdSocketMap.get(targetUserId);
          writeResponse({ response, responseSocket });
        } else {
          // Publish the notification to the target task:
          console.log(`Task ${CURRENT_TASK_ID}: Publishing notification to task ${targetTaskId} for user ${targetUserId}`);
          await publisher.publish(`task:${targetTaskId}`, JSON.stringify({ ...notificationMessage, targetUserId }));
        }
      }
    } catch (error) {
      console.error(`Task ${CURRENT_TASK_ID}: Error publishing notification ${JSON.stringify(notificationMessage)}:`, error);
    }
  }
};

// Handle incoming messages from Redis pub/sub
async function onRedisPubSubMessage(channel, message) {
  try {
    console.log(`Task ${CURRENT_TASK_ID}: Received thru channel '${channel}' : ${message}`);
    const notification = JSON.parse(message);
    if (notification.type === 'notification') {
      // Write to the response socket in the current task:
      const responseSocket = userIdSocketMap.get(notification.targetUserId);
      writeResponse({ response: notification.response, responseSocket });
    }
  } catch (error) {
    console.error(`Task ${CURRENT_TASK_ID}: Error processing pub/sub message:`, error);
  }
}

/*
  on disconnect from a websocket client:
 */
const onWebsocketDisconnect = async (socket) => {
  try {
    const redisClient = getRedisClient();
    await redisClient.hdel(CONNECTED_USERS_TO_TASKS_IDS_MAP, socket.userId);
    await redisClient.hdel(CONNECTED_USERS_IDS_TO_NAMES_MAP, socket.userId);
    console.log(`Task ${CURRENT_TASK_ID}: User ${socket.userId} disconnected and removed from ${CONNECTED_USERS_TO_TASKS_IDS_MAP}.`);
    console.log(`Task ${CURRENT_TASK_ID}: User ${socket.userId} disconnected and removed from ${CONNECTED_USERS_IDS_TO_NAMES_MAP}.`);

    userIdSocketMap.delete(socket.userId);

    // Broadcast the updated connections list to all other users
    // const connectionsAndUsernames = await getConnectionsAndUsernames();
    // await broadcastConnectionsUpdate(connectionsAndUsernames, socket.userId);
  } catch (error) {
    console.error(`Task ${CURRENT_TASK_ID}: Error during disconnect:`, error);
  }
};

// Transform Redis hash map into array of connection objects
async function getConnectionsAndUsernames() {
  const redisClient = getRedisClient();
  const usersMap = await redisClient.hgetall(CONNECTED_USERS_IDS_TO_NAMES_MAP);
  return Object.entries(usersMap).map(([connectionId, username]) => ({
    connectionId,
    username,
  }));
}

// Broadcast connections update to all users except the specified one
async function broadcastConnectionsUpdate(connectionsAndUsernames, excludeUserId) {
  try {
    const redisClient = getRedisClient();
    const connectionsUpdate = { connectionsAndUsernames };

    // Get all connected users and their task IDs
    const connectedUsersTasksMap = await redisClient.hgetall(CONNECTED_USERS_TO_TASKS_IDS_MAP);

    for (const [userId, taskId] of Object.entries(connectedUsersTasksMap)) {
      if (userId === excludeUserId) continue;

      // If user is in the current task, send directly through websocket
      const localSocket = userIdSocketMap.get(userId);
      if (localSocket) writeResponse({ response: connectionsUpdate, responseSocket: localSocket });
      else {
        // if (taskId !== CURRENT_TASK_ID)
        // Otherwise publish to their task's channel
        const notificationMessage = {
          type: 'notification',
          targetUserId: userId,
          response: connectionsUpdate,
        };
        await publisher.publish(`task:${taskId}`, JSON.stringify(notificationMessage));
      }
    }
  } catch (error) {
    console.error(`Task ${CURRENT_TASK_ID}: Error broadcasting connections update:`, error);
  }
}

// Helper function to check if a user is an admin
function isAdminUser(userId) {
  return userId === process.env.ADMIN_USER_ID;
}

// Helper function to write a response to the client
function writeResponse({ response, responseSocket }) {
  if (response) {
    if (responseSocket) responseSocket.send(JSON.stringify(response));
    console.log(
      `Task ${CURRENT_TASK_ID}: Response ${
        process.env.ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'true' ? JSON.stringify(response, null, 2) : JSON.stringify(response).substring(0, 500)
      }${responseSocket ? ' sent to the client' : ''}.`
    );
  } else throw `Task ${CURRENT_TASK_ID}: No response was prepared!`;
}

// Cleanup on process exit
process.on('SIGTERM', async () => {
  await subscriber.unsubscribe();
  await subscriber.quit();
  await publisher.quit();
});

module.exports = { onWebsocketConnect, CURRENT_TASK_ID };
