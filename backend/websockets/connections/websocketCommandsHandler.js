const AWSXRay = require('aws-xray-sdk-core');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { handleCommand, determineTargetUsers } = require('/opt/commandsHandlers');
const { getRedisClient /*, disposeRedisClient*/, insertMessageToSQS } = require('/opt/redisClient');

const redisClient = getRedisClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const STACK_NAME = process.env.STACK_NAME;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;

//=============================================================================================================================================
// 1. Receives an event from a connected websocket client.
// 2. Gets required data from redis using the sender's connectionId (event.requestContext.connectionId).
// 3. Performs CRUD operations on the database.
// 4. Broadcasts the data to other connected users thru an SQS queue (another handler in the default lambda space takes this responsibility).
//=============================================================================================================================================
exports.handler = async (event) => {
  // console.log(JSON.stringify(event, null, 2));

  const segment = AWSXRay.getSegment();
  segment.addAnnotation('stackName', STACK_NAME);
  const handlerSubsegment = segment.addNewSubsegment('websocketCommandsHandler');

  let statusCode = 200;

  try {
    const senderConnectionId = event.requestContext.connectionId;
    const incomingData = JSON.parse(event.body).data;

    const { type: commandType, params: commandParams } = incomingData.command;
    const connectedUserId = await getUserId(senderConnectionId);

    const handleCommandSubsegment = handlerSubsegment.addNewSubsegment('handleCommand');
    const response = await handleCommand({ commandType, commandParams, connectedUserId });
    handleCommandSubsegment.close();

    const targetUserIds = determineTargetUsers({ commandType, commandParams, response, connectedUserId });

    // Send the message to target websockets connected users through SQS
    if (response) {
      const targetConnectionIds = await getConnectionIdsForUsers(targetUserIds);
      if (targetConnectionIds.length > 0) {
        const sqsClient = captureAWSv3Client(new SQSClient({ region: AWS_REGION }));
        await insertMessageToSQS(JSON.stringify({ targetConnectionIds, message: response }), sqsClient, SQS_MESSAGES_TO_CLIENTS_Q_URL);
      }
    } else statusCode = 400; // bad request
  } catch (error) {
    console.error('Error message:', error.message);
    console.error(error.stack);
    console.error(`Error processing event: ${JSON.stringify(event, null, 2)}`);
    statusCode = 500; // internal server error
  } finally {
    handlerSubsegment.close();
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
