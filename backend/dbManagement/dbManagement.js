const { Client } = require('pg');
const { initializeDatabase } = require('./dbInitializer');
const { createRentTrackingTables, testRentTrackingOperations, getRentTrackingStats } = require('./rentTrackingOperations');
const { createGenericTables, createTestUser, getGenericStats } = require('./genericOperations');
const { createPlaceholderTables, getPlaceholderStats } = require('./placeholderOperations');

exports.handler = async (event = {}) => {
  const requestedDbName = process.env.DB_NAME;
  const clientParams = {
    host: process.env.RDS_ENDPOINT,
    database: 'postgres', // Default database
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: {
      rejectUnauthorized: false,
    },
  };

  let dbClient;

  try {
    // Initialize database
    const dbInit = await initializeDatabase(clientParams, requestedDbName);
    if (!dbInit.success) {
      throw dbInit.error;
    }

    // Connect to the specific database
    dbClient = new Client({ ...clientParams, database: requestedDbName });
    await dbClient.connect();

    // Only get stats if explicitly requested
    if (event.skipTablesCreation === true) {
      // Get existing data stats
      const rentTrackingStats = await getRentTrackingStats(dbClient);
      const genericStats = await getGenericStats(dbClient);
      const placeholderStats = await getPlaceholderStats(dbClient);

      if (!rentTrackingStats.success || !genericStats.success || !placeholderStats.success) {
        throw new Error('Failed to get database statistics');
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Database statistics retrieved successfully',
          stats: {
            ...rentTrackingStats.stats,
            ...genericStats.stats,
            ...placeholderStats.stats,
          },
        }),
      };
    }

    console.log('Creating database tables...');

    // Create generic tables first (users)
    const genericTablesResult = await createGenericTables(dbClient, event.dropTables);
    if (!genericTablesResult.success) {
      throw genericTablesResult.error;
    }
    console.log('Generic tables created successfully');

    // Create test user
    const userResult = await createTestUser(dbClient, process.env.SAAS_TENANT_ID);
    if (!userResult.success) {
      throw userResult.error;
    }
    console.log('Test user created successfully');

    // Create rentTracking tables (apartments and payments)
    const rentTrackingTablesResult = await createRentTrackingTables(dbClient);
    if (!rentTrackingTablesResult.success) {
      throw rentTrackingTablesResult.error;
    }
    console.log('RentTracking tables created successfully');

    // Create placeholder tables
    const placeholderTablesResult = await createPlaceholderTables(dbClient, event.dropTables);
    if (!placeholderTablesResult.success) {
      throw placeholderTablesResult.error;
    }
    console.log('Placeholder tables created successfully');

    // Test rentTracking operations
    const rentTrackingResult = await testRentTrackingOperations(dbClient, process.env.SAAS_TENANT_ID);
    if (!rentTrackingResult.success) {
      throw rentTrackingResult.error;
    }
    console.log('RentTracking operations tested successfully');

    // Get final statistics
    const finalRentTrackingStats = await getRentTrackingStats(dbClient);
    const finalGenericStats = await getGenericStats(dbClient);
    const finalPlaceholderStats = await getPlaceholderStats(dbClient);

    if (!finalRentTrackingStats.success || !finalGenericStats.success || !finalPlaceholderStats.success) {
      throw new Error('Failed to get final statistics');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Database operations completed successfully',
        stats: {
          ...finalRentTrackingStats.stats,
          ...finalGenericStats.stats,
          ...finalPlaceholderStats.stats,
        },
      }),
    };
  } catch (error) {
    console.error('Error during database operations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('Failed to perform database operations: ' + error.message),
    };
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
};
