const jwt = require('jsonwebtoken');
const AWSXRay = require('aws-xray-sdk');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { ApiGatewayManagementApiClient } = require('@aws-sdk/client-apigatewaymanagementapi');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { collectConnectionsAndUsernames, sendMessageToConnectedClients } = require('/opt/connections');
const dbData = require('/opt/dbData');
const { handleRead } = require('/opt/commandsHandlers');
const { getRedisClient /*, disposeRedisClient*/, insertMessageToSQS } = require('/opt/redisClient');

const redisClient = getRedisClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const STACK_NAME = process.env.STACK_NAME;
const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL ? process.env.WEBSOCKET_API_URL.replace(/^wss/, 'https') : null;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

//======================================================================================================
// $connect handler:
//======================================================================================================
exports.handler = async (event) => {
  if (!event.requestContext) {
    console.error('Invalid event: ', JSON.stringify(event, null, 2));
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing requestContext' }) };
  }

  const segment = AWSXRay.getSegment();
  segment.addAnnotation('stackName', STACK_NAME);
  const handlerSubsegment = segment.addNewSubsegment('$connectHandler');

  try {
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
    const connectedUserId = decodedJwt.sub;
    const connectedUserName = decodedJwt.name;
    const connectedUserEmail = decodedJwt.email;
    const connectedUserPhoneNumber = decodedJwt.phone_number;
    console.log(`currentConnectionId: ${currentConnectionId}`);
    // console.log(JSON.stringify(decodedJwt, null, 2));

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

    const connectionsAndUsernamesSubsegment = handlerSubsegment.addNewSubsegment('redisExecution');
    const EXPIRATION_TIME = /*12 **/ 60 * 60; // === 12 hours
    const connectionIds = await redisClient.eval(
      luaScript,
      1,
      currentConnectionId,
      connectedUserId,
      connectedUserName,
      connectedUserEmail,
      STACK_NAME,
      EXPIRATION_TIME
    );
    const connectionsAndUsernames = await collectConnectionsAndUsernames(connectionIds, redisClient, STACK_NAME);

    const sqsClient = captureAWSv3Client(new SQSClient({ region: AWS_REGION }));

    const appGatewayClient = WEBSOCKET_API_URL
      ? captureAWSv3Client(new ApiGatewayManagementApiClient({ apiVersion: '2018-11-29', endpoint: WEBSOCKET_API_URL }))
      : null;

    // Send all connected usernames (including the current user) to all connected users excluding the current user (handled below):
    const targetConnectionIds = connectionIds.filter((connectionId) => connectionId !== currentConnectionId);
    if (targetConnectionIds.length > 0) {
      if (WEBSOCKET_API_URL)
        await sendMessageToConnectedClients({
          targetConnectionIds,
          message: JSON.stringify({ connectionsAndUsernames }),
          appGatewayClient,
        });
      else await insertMessageToSQS(JSON.stringify({ targetConnectionIds, message: { connectionsAndUsernames } }), sqsClient, SQS_MESSAGES_TO_CLIENTS_Q_URL);
    }
    connectionsAndUsernamesSubsegment.close();

    // Wrap database operations in a timeout of 5 seconds:
    const dbOperationSubsegment = handlerSubsegment.addNewSubsegment('dbOperation');
    const MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS = 5000;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Database operation timeout')), MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS));
    const dbOperationPromise = async () => {
      // Read and send data to the frontend:
      let response = {
        targetConnectionIds: [currentConnectionId],
        message: { currentUserEmail: connectedUserEmail, connectionsAndUsernames },
      };
      if (connectedUserId === ADMIN_USER_ID) response.message.userType = 'Admin';
      else {
        const saasTenantsArray = await dbData.cache.getSaasTenants({ connectedUserId });
        response.message.userType = saasTenantsArray.length === 0 ? 'Pending' : !saasTenantsArray[0].is_disabled ? 'Landlord' : 'Tenant';
        if (response.message.userType === 'Landlord') {
          response.message = {
            ...response.message,
            ...(await handleRead({
              commandParams: {
                apartments: true,
                activity: { fromFirstApartment: true },
              },
              connectedUserId: connectedUserId,
            })),
          };
        }
      }
      return response;
    };

    let response;
    try {
      response = await Promise.race([dbOperationPromise(), timeoutPromise]);
    } catch (error) {
      console.error('$connect: Database operation failed:', error);
      response = { targetConnectionIds: [currentConnectionId], message: { dbAccess: { MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS } } };
    }

    if (WEBSOCKET_API_URL)
      await sendMessageToConnectedClients({
        targetConnectionIds: response.targetConnectionIds,
        message: JSON.stringify(response.message),
        appGatewayClient,
      });
    else await insertMessageToSQS(JSON.stringify(response), sqsClient, SQS_MESSAGES_TO_CLIENTS_Q_URL);
    dbOperationSubsegment.close();

    return { statusCode: 200 };
  } catch (error) {
    console.error('$connect:', error, event);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  } finally {
    handlerSubsegment.close();
  }
};

//=============================================================================================================================================
// Utilities
//=============================================================================================================================================
