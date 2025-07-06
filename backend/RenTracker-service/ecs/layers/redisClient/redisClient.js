const Redis = require('ioredis');
const { SendMessageCommand } = require('@aws-sdk/client-sqs');

const REDIS_ADDRESS = process.env.REDIS_ADDRESS;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD; // Password for Redis, if required

let _redisClient = null;
let _publisherClient = null;
let _subscriberClient = null;

const getRedisClient = () => {
  console.log(`Connecting to Redis at ${REDIS_ADDRESS}`);
  if (!_redisClient) _redisClient = REDIS_PASSWORD ? new Redis({ host: REDIS_ADDRESS, password: REDIS_PASSWORD }) : new Redis(REDIS_ADDRESS);

  return _redisClient;
};

const getPublisherClient = () => {
  console.log(`Connecting to Redis at ${REDIS_ADDRESS}`);
  if (!_publisherClient) _publisherClient = REDIS_PASSWORD ? new Redis({ host: REDIS_ADDRESS, password: REDIS_PASSWORD }) : new Redis(REDIS_ADDRESS);
  return _publisherClient;
};

const getSubscriberClient = () => {
  console.log(`Connecting to Redis at ${REDIS_ADDRESS}`);
  if (!_subscriberClient) _subscriberClient = REDIS_PASSWORD ? new Redis({ host: REDIS_ADDRESS, password: REDIS_PASSWORD }) : new Redis(REDIS_ADDRESS);
  return _subscriberClient;
};

const disposeRedisClient = async () => {
  if (_redisClient) {
    await _redisClient.quit();
    _redisClient = null;
  }
  if (_publisherClient) {
    await _publisherClient.quit();
    _publisherClient = null;
  }
  if (_subscriberClient) {
    await _subscriberClient.quit();
    _subscriberClient = null;
  }
};

// Test Redis connectivity
async function testRedisConnectivity() {
  try {
    const redisClient = getRedisClient();
    const keys = await redisClient.keys('*');

    if (keys.length > 0) {
      console.log(`Found ${keys.length} keys :`);
      keys.sort();

      for (const key of keys) {
        const type = await redisClient.type(key);
        if (type === 'string') {
          const value = await redisClient.get(key);
          console.log(`${key.padEnd(35, ' ')}  ==>  ${value}`);
        } else if (type === 'set') {
          const members = await redisClient.smembers(key);
          const MAX_KEY_LENGTH = 40;
          console.log(
            `${key.length < MAX_KEY_LENGTH ? key.padEnd(MAX_KEY_LENGTH, ' ') : `${key.substring(0, MAX_KEY_LENGTH - 2)}..`}  ==>  ${JSON.stringify(members)}`
          );
        } else if (type === 'list') {
          const length = await redisClient.llen(key);
          console.log(`${key.padEnd(25, ' ')} ==> ${length} items`);
        } else if (type === 'hash') {
          const fields = await redisClient.hkeys(key);
          const fieldValues = {};

          for (const field of fields) {
            const value = await redisClient.hget(key, field);
            fieldValues[field] = value;
          }

          console.log(`Hash ${key} : ${JSON.stringify(fieldValues)}`);
        } else {
          console.log(`The value of '${key}' is '${type}' ! (not a string, set, list, or hash)`);
        }
      }
    }

    return keys.length;
  } catch (error) {
    console.error('Redis Connectivity Test Failed:', error);
  }
}

//=============================================================================================================================================
// Websockets thru SQS
//=============================================================================================================================================
// Inserts a message into the SQS queue
const insertMessageToSQS = async (messageBody, sqsClient, SQS_MESSAGES_TO_CLIENTS_Q_URL) => {
  const sqsParams = {
    QueueUrl: SQS_MESSAGES_TO_CLIENTS_Q_URL,
    MessageBody: messageBody,
  };
  console.log(`Inserting a message into the SQS queue: ${messageBody.length} bytes, ${messageBody.substring(0, 500)} ...`);
  try {
    await sqsClient.send(new SendMessageCommand(sqsParams));
  } catch (error) {
    console.error(`Error inserting a message into the SQS queue : ${messageBody} : ${error}`);
  }
};

module.exports = {
  getRedisClient,
  getPublisherClient,
  getSubscriberClient,
  disposeRedisClient,
  testRedisConnectivity,
  insertMessageToSQS,
};
