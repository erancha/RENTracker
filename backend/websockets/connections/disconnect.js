const { SQSClient } = require('@aws-sdk/client-sqs');
const { collectConnectionsAndUsernames, insertMessageToSQS } = require('/opt/connections');
const { getRedisClient /*, disposeRedisClient*/ } = require('/opt/redisClient');
const redisClient = getRedisClient();

const AWS_REGION = process.env.APP_AWS_REGION;
const STACK_NAME = process.env.STACK_NAME;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;

//===========================================
// $disconnect handler:
//===========================================
exports.handler = async (event) => {
  const currentConnectionId = event.requestContext.connectionId;

  try {
    // Lua script to handle disconnection atomically
    const luaScript = `
        local connectionId = KEYS[1]
        local STACK_NAME = ARGV[1]

        -- Get connection data from hash
        local connData = redis.call('HGETALL', STACK_NAME .. ':conn:' .. connectionId)
        if #connData > 0 then
          -- Example: if hash contains: userId=123 userName=John
          -- then connData = ["userId","123","userName","John"]
          local data = {}
          for i = 1, #connData, 2 do
            -- i=1: data["userId"] = "123"
            -- i=3: data["userName"] = "John"
            data[connData[i]] = connData[i + 1]
          end

          -- Now we can easily access values like: data.userId, data.userName, etc.

          -- Remove from user's connections set
          if data.userId then
            redis.call('SREM', STACK_NAME .. ':user:' .. data.userId .. ':connections', connectionId)
          end

          -- Remove connection hash
          redis.call('DEL', STACK_NAME .. ':conn:' .. connectionId)

          -- Remove from active connections set
          redis.call('SREM', STACK_NAME .. ':active_connections', connectionId)
        end

        -- Return remaining active connections
        return redis.call('SMEMBERS', STACK_NAME .. ':active_connections')
    `;
    const updatedConnectionIds = await redisClient.eval(luaScript, 1, currentConnectionId, STACK_NAME);
    if (updatedConnectionIds.length > 0) {
      // Send all connected usernames (after removing the current disconnecting user) to all other connected users:
      const sqsClient = new SQSClient({ region: AWS_REGION });
      await insertMessageToSQS(
        JSON.stringify({
          targetConnectionIds: updatedConnectionIds,
          message: { connectionsAndUsernames: await collectConnectionsAndUsernames(updatedConnectionIds, redisClient, STACK_NAME) },
        }),
        sqsClient,
        SQS_MESSAGES_TO_CLIENTS_Q_URL
      );
    } else console.info(`No remaining connected users were found, STACK_NAME: ${STACK_NAME}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error('$disconnect:', error, event);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
};
