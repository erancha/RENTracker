const { SQSClient } = require('@aws-sdk/client-sqs');
const { insertMessageToSQS } = require('/opt/connections');
const { handleCommand, determineTargetUsers } = require('/opt/commandsHandlers');
const { getRedisClient /*, disposeRedisClient*/ } = require('/opt/redisClient');
const redisClient = getRedisClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const STACK_NAME = process.env.STACK_NAME;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;
const SAAS_TENANT_ID = process.env.SAAS_TENANT_ID;

//=============================================================================================================================================
// 1. Receives one request from a connected websocket client.
// 2. Gets required data from redis using the sender's connectionId (event.requestContext.connectionId).
// 3. Performs CRUD operations on the database.
// 4. Broadcasts the data to other connected users thru an SQS queue (another handler in the default lambda space takes this responsibility).
//=============================================================================================================================================
exports.handler = async (event) => {
  // if (event.testPG) return await testPGOperations();
  let statusCode = 200;

  try {
    // console.log(JSON.stringify(event, null, 2));
    const senderConnectionId = event.requestContext.connectionId;
    const incomingData = JSON.parse(event.body).data;

    const { type: commandType, params: commandParams } = incomingData.command;
    const connectedUserId = await getUserId(senderConnectionId);
    const response = await handleCommand({ commandType, commandParams, connectedUserId });
    const targetUserIds = determineTargetUsers({ commandType, commandParams, response, connectedUserId });

    // Send the message to target websockets connected users through SQS
    if (response) {
      const targetConnectionIds = await getConnectionIdsForUsers(targetUserIds);
      if (targetConnectionIds.length > 0) {
        const sqsClient = new SQSClient({ region: AWS_REGION });
        await insertMessageToSQS(
          JSON.stringify({
            targetConnectionIds,
            message: response,
          }),
          sqsClient,
          SQS_MESSAGES_TO_CLIENTS_Q_URL
        );
      }
    } else statusCode = 400; // bad request
  } catch (error) {
    console.error('Full error details:');
    console.error(error.stack); // This will show the full stack trace
    console.error('Error message:', error.message);
    console.error(`Error processing event: ${JSON.stringify(event, null, 2)}`);
    console.error('Error occurred at:', new Date().toISOString());
    statusCode = 500; // internal server error
  }

  return { statusCode };
};

//=============================================================================================================================================
// Redis Helpers
//=============================================================================================================================================

// Retrieves user-specific (if userId is defined) or all connection IDs from Redis.
const getConnectionIds = async (userId) => {
  const luaScript = `
    local userId = KEYS[1]
    local STACK_NAME = ARGV[1]
    
    -- If userId is provided, return user's connections, otherwise return all active connections
    if userId and userId ~= '' then
      return redis.call('SMEMBERS', STACK_NAME .. ':user:' .. userId .. ':connections')
    else
      return redis.call('SMEMBERS', STACK_NAME .. ':active_connections')
    end
  `;

  try {
    return await redisClient.eval(luaScript, 1, userId ?? '', STACK_NAME);
  } catch (error) {
    console.error(`Error while getting connection ids: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
};

// Retrieves connection IDs for multiple users
const getConnectionIdsForUsers = async (userIds) => {
  const targetConnectionIdsSet = new Set();

  await Promise.all(
    userIds.map(async (userId) => {
      const connections = await getConnectionIds(userId);
      connections.forEach((connId) => targetConnectionIdsSet.add(connId));
    })
  );

  const targetConnectionIds = Array.from(targetConnectionIdsSet);
  // console.log(JSON.stringify({ userIds, targetConnectionIds }, null, 2));
  return targetConnectionIds;
};

// Retrieves user ID associated with a connection ID
const getUserId = async (connectionId) => {
  try {
    return await redisClient.hget(`${STACK_NAME}:conn:${connectionId}`, 'userId');
  } catch (error) {
    console.error(`Error while getting user id: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
};
