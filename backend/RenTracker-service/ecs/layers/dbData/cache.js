const { getRedisClient } = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? require('/opt/redisClient') // Lambda environment
  : require('/usr/src/app/layers/redisClient/redisClient'); // Local/ECS environment

/*
 * Key differences between Cache-Aside and Cache-Through patterns:
 *
 * Cache-Aside (what your code currently uses):
 *   Application is responsible for managing the cache
 *   On read:
 *     - Check cache first
 *     - If cache miss, read from DB
 *     - Application updates cache with new data
 *   On write:
 *     - Application updates DB directly
 *     - Cache entry is either invalidated or updated
 *   Pros:
 *     - More control over what gets cached
 *     - Cache failures don't block DB operations
 *     - Works well for read-heavy workloads
 *   Cons:
 *     - Can lead to stale data if DB is updated directly
 *     - More complex application code as it manages caching logic
 *
 * Cache-Through:
 *   Cache manages data persistence
 *   On read:
 *     - All reads go through cache
 *     - Cache automatically loads from DB if needed
 *   On write:
 *     - Write goes to cache first
 *     - Cache is responsible for updating DB
 *     - Ensures cache and DB are synchronized
 *   Pros:
 *     - Simpler application code
 *     - Stronger consistency between cache and DB
 *     - Better for write-heavy workloads
 *   Cons:
 *     - Cache becomes critical infrastructure
 *     - Higher latency for writes
 *     - Cache failures affect all operations
 *
 * Your current implementation uses Cache-Aside, which is generally a good choice
 * for Lambda functions because:
 *   - It's more resilient to Redis failures
 *   - Provides better control over what data gets cached
 *   - Allows for easier cache invalidation strategies
 *   - Works well with the serverless/stateless nature of Lambda functions
 */

const get = async (cacheKey, dbFunction) => {
  try {
    const startTime = Date.now();
    const disableAppCache = process.env.DISABLE_APP_CACHE === 'true';
    const fullCacheKey = `${process.env.STACK_NAME}:${cacheKey}`;
    const redisClient = getRedisClient();
    const elapsedTimeRedisClient = Date.now() - startTime;

    if (!disableAppCache) {
      const cachedData = await redisClient.get(fullCacheKey);
      if (cachedData) {
        console.log(
          `Cache hit for ${cacheKey}: ${cachedData.length} bytes, completed in ${(
            Date.now() - startTime
          ).toLocaleString()} ms (${elapsedTimeRedisClient.toLocaleString()} ms to getRedisClient).`
        );
        return JSON.parse(cachedData);
      }
    }

    const data = await dbFunction();

    if (!disableAppCache) {
      await redisClient.set(fullCacheKey, JSON.stringify(data), 'EX', 24 * 60 * 60); // Set expiration time to 24 hours
    }
    return data;
  } catch (error) {
    console.error(`Error in cache wrapper for ${cacheKey}: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
};

const invalidateGet = async (cacheKey) => {
  try {
    const disableAppCache = process.env.DISABLE_APP_CACHE === 'true';
    const fullCacheKey = `${process.env.STACK_NAME}:${cacheKey}`;

    if (!disableAppCache) {
      const redisClient = getRedisClient();
      await redisClient.del(fullCacheKey);
      console.log(`Cache invalidated for key: ${cacheKey}`);
    }
  } catch (error) {
    console.error(`Error invalidating cache for ${cacheKey}: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
};

module.exports = {
  get,
  invalidateGet,
};
