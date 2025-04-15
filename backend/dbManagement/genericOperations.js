const { Client } = require('pg');

// Temporary test user constants
const TEMP_USER_ID = '43e4c8a2-4081-70d9-613a-244f8f726307';
const TEMP_USER_NAME = 'RENTracker User';
const TEMP_USER_EMAIL = 'bettyuser100@gmail.com';

const createGenericTables = async (dbClient, dropTables = false) => {
  try {
    // Drop existing tables if requested
    if (dropTables) {
      const dropTablesQuery = `
        DROP TABLE IF EXISTS users;
      `;
      await dbClient.query(dropTablesQuery);
      console.log('Existing generic tables dropped.');
    }

    // Create extension
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Create users table (core table needed by other domains)
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        email_address TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL UNIQUE,
        is_disabled BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tenant_id UUID NOT NULL
      );
    `;
    await dbClient.query(createUsersTable);

    return { success: true };
  } catch (error) {
    console.error('Error creating generic tables:', error);
    return { success: false, error };
  }
};

const createTestUser = async (dbClient, saasTenantId) => {
  try {
    const insertUserQuery = `
      INSERT INTO users (user_id, user_name, email_address, tenant_id) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO NOTHING;
    `;
    await dbClient.query(insertUserQuery, [TEMP_USER_ID, TEMP_USER_NAME, TEMP_USER_EMAIL, saasTenantId]);
    return { success: true };
  } catch (error) {
    console.error('Error creating test user:', error);
    return { success: false, error };
  }
};

const getGenericStats = async (dbClient) => {
  try {
    const stats = {};

    // Get users count
    const usersQuery = 'SELECT COUNT(*) FROM users;';
    const usersResult = await dbClient.query(usersQuery);
    stats.usersCount = parseInt(usersResult.rows[0].count);

    return { success: true, stats };
  } catch (error) {
    console.error('Error getting generic stats:', error);
    return { success: false, error };
  }
};

module.exports = {
  createGenericTables,
  createTestUser,
  getGenericStats,
  TEMP_USER_ID, // Export for rentTracking operations reference
};
