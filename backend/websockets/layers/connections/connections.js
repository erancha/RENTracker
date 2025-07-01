// Updated to force new layer version
const { PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

//================================================================
// Prepares an array of {connection, username}:
//================================================================
/**
 * Collects connection data for all provided connection IDs
 * Uses pipelining to efficiently batch Redis requests
 */
async function collectConnectionsAndUsernames(connectionIds, redisClient, STACK_NAME) {
  let connectionsAndUsernames = [];

  // Use pipeline to batch all hash retrievals
  const pipeline = redisClient.pipeline();
  connectionIds.forEach((connectionId) => {
    pipeline.hgetall(`${STACK_NAME}:conn:${connectionId}`);
  });

  try {
    const results = await pipeline.exec();
    results.forEach((result, index) => {
      const [error, connData] = result;
      if (error) {
        console.error(`Error reading connection data for: '${connectionIds[index]}'`, error);
        return;
      }

      // If connection data exists and has username, add to result
      if (connData && connData.userName) {
        connectionsAndUsernames.push({
          connectionId: connectionIds[index],
          username: connData.userName,
        });
      } else {
        // Connection data missing or incomplete - clean up stale connection
        redisClient.srem(`${STACK_NAME}:active_connections`, connectionIds[index]);
        if (connData && connData.userId) {
          redisClient.srem(`${STACK_NAME}:user:${connData.userId}:connections`, connectionIds[index]);
        }
      }
    });
  } catch (error) {
    console.error('Error executing pipeline:', error);
  }

  return connectionsAndUsernames;
}

//=========================================================================================================================================
// Send message to each connection of targetConnectionIds.
//=========================================================================================================================================
async function sendMessageToConnectedClients({ targetConnectionIds, message, appGatewayClient }) {
  const MAX_LOG_LENGTH = 1000;
  const logMessage = `${message.substring(0, MAX_LOG_LENGTH)}${message.length > MAX_LOG_LENGTH ? ' ...' : ''}, message length: ${message.length} bytes`;
  console.log(`Sending websocket messages: ${logMessage}, to: ${JSON.stringify(targetConnectionIds)} ...`);

  const bufferData = Buffer.from(message);
  for (const connectionId of targetConnectionIds) {
    try {
      await appGatewayClient.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: bufferData,
        })
      );
      console.log(`Sent websocket messages to: ${targetConnectionIds}`);
    } catch (error) {
      const errorMessage = `connectionId: ${connectionId}, payload size: ${bufferData.length} bytes: ${logMessage}`;
      if (error.name === 'GoneException') console.warn(error.name, errorMessage);
      else console.error(error, errorMessage);
    }
  }
}

module.exports = {
  collectConnectionsAndUsernames,
  sendMessageToConnectedClients,
};
