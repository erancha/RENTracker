const { Client } = require('pg');
const { TEMP_USER_ID } = require('./genericOperations');

const TEMP_APARTMENT_ID = 'apartment123';

const createRentTrackingTables = async (dbClient) => {
  try {
    // Create rentTracking tables
    const createRentTrackingTablesQuery = `
      CREATE TABLE IF NOT EXISTS apartments (
        id SERIAL,
        apartment_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(user_id),
        // is_disabled BOOLEAN NULL,
        balance DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tenant_id UUID NOT NULL,
        PRIMARY KEY (tenant_id, apartment_id)
      );

      CREATE TABLE IF NOT EXISTS apartmentActivity (
        id UUID DEFAULT uuid_generate_v4(),
        apartment_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        activity BYTEA NOT NULL,
        encryptedActivity BYTEA,
        tenant_id UUID NOT NULL,
        PRIMARY KEY (tenant_id, apartment_id, id)
      );
    `;
    await dbClient.query(createRentTrackingTablesQuery);

    // Create rentTracking-specific indexes
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_user_id ON apartments(user_id);
    `;
    await dbClient.query(createIndexesQuery);

    return { success: true };
  } catch (error) {
    console.error('Error creating rentTracking tables:', error);
    return { success: false, error };
  }
};

const testRentTrackingOperations = async (dbClient, saasTenantId) => {
  try {
    // Add a test apartment record
    const addApartmentRecordQuery = `
      INSERT INTO apartments (tenant_id, apartment_id, user_id, balance) 
      VALUES ($1, $2, $3, $4);
    `;
    await dbClient.query(addApartmentRecordQuery, [saasTenantId, TEMP_APARTMENT_ID, TEMP_USER_ID, 100.0]);

    // Delete the test record
    const deleteRecordQuery = `
      DELETE FROM apartments 
      WHERE apartment_id = $1;
    `;
    await dbClient.query(deleteRecordQuery, [TEMP_APARTMENT_ID]);

    return { success: true };
  } catch (error) {
    console.error('Error during rentTracking operations test:', error);
    return { success: false, error };
  }
};

const getRentTrackingStats = async (dbClient) => {
  try {
    const stats = {};

    // Get apartments count
    const apartmentsQuery = 'SELECT COUNT(*) FROM apartments;';
    const apartmentsResult = await dbClient.query(apartmentsQuery);
    stats.apartmentsCount = parseInt(apartmentsResult.rows[0].count);

    // Get activity count
    const activityQuery = 'SELECT COUNT(*) FROM apartmentActivity;';
    const activityResult = await dbClient.query(activityQuery);
    stats.activityCount = parseInt(activityResult.rows[0].count);

    return { success: true, stats };
  } catch (error) {
    console.error('Error getting rentTracking stats:', error);
    return { success: false, error };
  }
};

module.exports = {
  createRentTrackingTables,
  testRentTrackingOperations,
  getRentTrackingStats,
};
