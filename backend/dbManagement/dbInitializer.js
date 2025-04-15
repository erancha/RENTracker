const { Client } = require('pg');

const initializeDatabase = async (clientParams, requestedDbName) => {
  // First connect to 'postgres' database to create the new database
  const initialClient = new Client(clientParams);

  try {
    await initialClient.connect();

    // Check if database exists (case-insensitive search)
    const dbExistsQuery = `SELECT 1 FROM pg_database WHERE datname = $1;`;
    const dbExistsResult = await initialClient.query(dbExistsQuery, [requestedDbName]);

    // Create database if it doesn't exist
    if (dbExistsResult.rowCount === 0) {
      try {
        const createDBQuery = `CREATE DATABASE ${requestedDbName};`;
        await initialClient.query(createDBQuery);
        console.log(`Database ${requestedDbName} created.`);
      } catch (createError) {
        // Check if the error is "database already exists"
        if (createError.code === '42P04') {
          console.log(`Database ${requestedDbName} already exists (concurrent creation).`);
        } else {
          throw createError;
        }
      }
    } else {
      // Get the actual database name with its case
      const getActualNameQuery = `SELECT datname FROM pg_database WHERE datname = $1;`;
      const actualNameResult = await initialClient.query(getActualNameQuery, [requestedDbName]);
      const actualDbName = actualNameResult.rows[0].datname;
      console.log(`Database ${actualDbName} already exists.`);
    }

    // Close the initial connection
    await initialClient.end();

    // Create a new connection to the newly created database
    const dbClient = new Client({ ...clientParams, database: requestedDbName });
    await dbClient.connect();

    // Test the connection
    await dbClient.query('SELECT 1');

    // Close the test connection
    await dbClient.end();

    return { success: true };
  } catch (error) {
    console.error('Error initializing database:', error);
    return { success: false, error };
  } finally {
    // Ensure initial client is closed if something went wrong
    if (initialClient) {
      try {
        await initialClient.end();
      } catch (err) {
        console.error('Error closing initial client:', err);
      }
    }
  }
};

module.exports = {
  initializeDatabase,
};
