// Middleware for logging parameters and elapsed time
const logMiddleware = (name) => (fn) => {
  const wrappedFunction = async function (...args) {
    const startTime = Date.now();

    if (process.env.ENABLE_ENHANCED_LOGGING?.toLowerCase() === 'true') {
      console.log(`Starting function '${name}' with parameters: ${JSON.stringify(args)}`);
    }

    try {
      const result = await fn(...args);

      const elapsedTime = Date.now() - startTime;
      console.log(`Function '${name}' completed in ${elapsedTime.toLocaleString()} ms`);

      return result;
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`Function '${name}' failed after ${elapsedTime.toLocaleString()} ms:`, error);
      throw error;
    }
  };
  wrappedFunction.name = name;
  return wrappedFunction;
};

module.exports = {
  logMiddleware,
  isLandlordUser: ({ user_id, saas_tenant_id }) => user_id === saas_tenant_id,
};
