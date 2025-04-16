const jwt = require('jsonwebtoken');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { collectConnectionsAndUsernames, insertMessageToSQS } = require('/opt/connections');
const dbData = require('/opt/dbData');
const { handleRead } = require('/opt/commandsHandlers');
const { getRedisClient /*, disposeRedisClient*/ } = require('/opt/redisClient');
const redisClient = getRedisClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const STACK_NAME = process.env.STACK_NAME;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const SAAS_TENANT_ID = process.env.SAAS_TENANT_ID;

//======================================================================================================
// $connect handler:
//======================================================================================================
exports.handler = async (event) => {
  // console.log('Event: ', JSON.stringify(event, null, 2));

  // Extract JWT token and category from the query string:
  let currentJwtToken;
  if (event.queryStringParameters && event.queryStringParameters.token) currentJwtToken = event.queryStringParameters.token;
  else throw new Error('JWT token is missing in the query string');
  const decodedJwt = jwt.decode(currentJwtToken);
  if (!decodedJwt || !decodedJwt.sub) throw new Error(`Invalid token: Missing user id (sub): ${currentJwtToken}, ${JSON.stringify(decodedJwt)}`);
  else {
    // Check if the token has expired //TODO: Introduce a Lambda authorizer - the $connect handler should receive a verified JWT.
    // console.log(JSON.stringify(decodedJwt, null, 2));
    const currentTimeInSeconds = Math.floor(Date.now() / 1000); // Convert to seconds
    if (decodedJwt.exp < currentTimeInSeconds) {
      throw new Error(`Token has expired ${currentTimeInSeconds - decodedJwt.exp} seconds ago`);
    } // else console.log(`Token will expire in ${decodedJwt.exp - currentTimeInSeconds} seconds ...`);
  }

  // Extract user id (sub) and user name from the token
  const currentConnectionId = event.requestContext.connectionId;
  const currentUserId = decodedJwt.sub;
  const currentUserName = decodedJwt.name;
  const currentUserEmail = decodedJwt.email;
  const currentUserPhoneNumber = decodedJwt.phone_number;

  /*
   * Key Points of the connections management implementation:
   * 1. Uses a single hash per connection to store all connection data
   *    - More intuitive data representation
   *    - Easier to inspect and debug
   *    - Reduced memory overhead (fewer keys)
   *
   * 2. Maintains Lua scripts for atomic operations
   *    - Single round trip to Redis
   *    - Ensures data consistency
   *    - Logic runs on Redis server
   *
   * 3. Key structure:
   *    - ${STACK_NAME}:conn:${connectionId} -> Hash storing connection details
   *    - ${STACK_NAME}:active_connections -> Set of all active connection IDs
   *    - ${STACK_NAME}:user:${userId}:connections -> Set of user's connection IDs
   */
  const luaScript = `
      local connectionId = KEYS[1]
      local userId = ARGV[1]
      local userName = ARGV[2]
      local userEmail = ARGV[3]
      local STACK_NAME = ARGV[4]
      local EXPIRATION_TIME = tonumber(ARGV[5])

      -- Store all connection data in a single hash
      redis.call('HMSET', STACK_NAME .. ':conn:' .. connectionId,
                'userId', userId,
                'userName', userName,
                'userEmail', userEmail,
                'connectedAt', redis.call('TIME')[1])
      
      -- Set expiration on the connection hash
      redis.call('EXPIRE', STACK_NAME .. ':conn:' .. connectionId, EXPIRATION_TIME)

      -- Add to active connections set
      redis.call('SADD', STACK_NAME .. ':active_connections', connectionId)
      redis.call('EXPIRE', STACK_NAME .. ':active_connections', EXPIRATION_TIME)
      
      -- Add to user's connections set
      redis.call('SADD', STACK_NAME .. ':user:' .. userId .. ':connections', connectionId)
      redis.call('EXPIRE', STACK_NAME .. ':user:' .. userId .. ':connections', EXPIRATION_TIME)

      -- Return all active connections for gathering state
      return redis.call('SMEMBERS', STACK_NAME .. ':active_connections')
  `;

  try {
    const EXPIRATION_TIME = /*12 **/ 60 * 60; // === 12 hours
    const connectionIds = await redisClient.eval(
      luaScript,
      1,
      currentConnectionId,
      currentUserId,
      currentUserName,
      currentUserEmail,
      STACK_NAME,
      EXPIRATION_TIME
    );
    const connectionsAndUsernames = await collectConnectionsAndUsernames(connectionIds, redisClient, STACK_NAME);
    // console.log(JSON.stringify(connectionsAndUsernames, null, 2));

    // Send all connected usernames (including the current user) to all connected users excluding the current user (handled below):
    const sqsClient = new SQSClient({ region: AWS_REGION });
    const targetConnectionIds = connectionIds.filter((connectionId) => connectionId !== currentConnectionId);
    if (targetConnectionIds.length > 0) {
      await insertMessageToSQS(
        JSON.stringify({
          targetConnectionIds: connectionIds.filter((connectionId) => connectionId !== currentConnectionId),
          message: { connectionsAndUsernames },
        }),
        sqsClient,
        SQS_MESSAGES_TO_CLIENTS_Q_URL
      );
    }

    // Wrap database operations in a timeout of 5 seconds:
    const MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS = 5000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Database operation timeout')), MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS));
    const dbOperationPromise = async () => {
      // Insert the user (if not already inserted). // LandlordsTable and TenantsTable serve no purpose in the current stack-per-landlord model ..
      // await dbData.upsertUser({ user_id: currentUserId, user_name: currentUserName, email: currentUserEmail, phone_number: currentUserPhoneNumber, saas_tenant_id: SAAS_TENANT_ID });

      // Read and send data to the frontend:
      const userType =
        currentUserId === ADMIN_USER_ID ? 'Admin' : dbData.isLandlordUser({ user_id: currentUserId, saas_tenant_id: SAAS_TENANT_ID }) ? 'Landlord' : 'Tenant';
      let response = {
        targetConnectionIds: [currentConnectionId],
        message: { userType, connectionsAndUsernames },
      };
      if (['Admin', 'Landlord'].includes(userType)) {
        response.message = {
          ...response.message,
          ...(await handleRead({
            commandParams: {
              apartments: true,
              activity: { fromFirstApartment: true },
            },
            connectedUserId: SAAS_TENANT_ID,
          })),
        };
      }
      return JSON.stringify(response);
    };

    let sqsMessageBody;
    try {
      sqsMessageBody = await Promise.race([dbOperationPromise(), timeoutPromise]);
    } catch (error) {
      console.error('$connect: Database operation failed:', error);
      sqsMessageBody = JSON.stringify({ targetConnectionIds: [currentConnectionId], message: { dbAccess: { MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS } } });
    }

    await insertMessageToSQS(sqsMessageBody, sqsClient, SQS_MESSAGES_TO_CLIENTS_Q_URL);

    return { statusCode: 200 };
  } catch (error) {
    console.error('$connect:', error, event);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
