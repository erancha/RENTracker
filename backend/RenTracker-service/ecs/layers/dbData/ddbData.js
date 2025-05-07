const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { logMiddleware, isLandlordUser } = require('./utils');
const { captureAWSv3Client } = require('aws-xray-sdk-core');

const AWS_REGION = process.env.APP_AWS_REGION;
const SAAS_TENANTS_TABLE_NAME = process.env.SAAS_TENANTS_TABLE_NAME;
const APARTMENTS_TABLE_NAME = process.env.APARTMENTS_TABLE_NAME;
const DOCUMENTS_TABLE_NAME = process.env.DOCUMENTS_TABLE_NAME;
const ACTIVITY_TABLE_NAME = process.env.ACTIVITY_TABLE_NAME;

// Create DynamoDB client with X-Ray tracing. X-Ray automatically propagates the parent trace ID
// from the Lambda context through the async context, so all DynamoDB operations made through
// this client will be linked as subsegments to the parent trace without any manual context passing
const ddbClient = captureAWSv3Client(new DynamoDBClient({ region: AWS_REGION }));
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// ============================================================================================
// Apartments Management Functions
// ============================================================================================

/**
 * Creates a new apartment in DynamoDB
 * @param {Object} params
 * @param {string} params.apartment_id - Unique identifier of the apartment
 * @param {string} params.address - Physical address of the apartment
 * @param {string} params.unit_number - Unit number within the building
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {number} params.rent_amount - Monthly rent amount
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created apartment data
 */
const createApartment = logMiddleware('ddb_createApartment')(
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, created_at, saas_tenant_id }) => {
    try {
      const item = {
        apartment_id,
        saas_tenant_id,
        address,
        unit_number,
        rooms_count,
        rent_amount,
        created_at,
        updated_at: created_at,
      };
      await ddbDocClient.send(
        new PutCommand({
          TableName: APARTMENTS_TABLE_NAME,
          Item: item,
        })
      );

      return {
        data: item,
        operation: 'created',
      };
    } catch (error) {
      console.error('Error in ddb_createApartment:', error);
      throw error;
    }
  }
);

/**
 * Retrieves all apartments owned by a landlord, isolated by SaaSTenant
 * @param {string} user_id - Landlord's unique identifier
 * @param {string} saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of apartments owned by the landlord
 */
const getApartmentsOfLandlord = logMiddleware('ddb_getApartmentsOfLandlord')(async ({ saas_tenant_id }) => {
  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: APARTMENTS_TABLE_NAME,
        IndexName: 'SaaSTenantUpdatedIndex',
        KeyConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        ExpressionAttributeValues: {
          ':saas_tenant_id': saas_tenant_id,
        },
        ScanIndexForward: false, // Sort in descending order by updated_at
      })
    );
    return Items || [];
  } catch (error) {
    console.error('Error in ddb_getApartmentsOfLandlord:', error);
    throw error;
  }
});

/**
 * Updates an apartment's details
 * @param {Object} params
 * @param {string} params.apartment_id - Unique identifier of the apartment
 * @param {string} params.address - Physical address of the apartment
 * @param {string} params.unit_number - Unit number within the building
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {number} params.rent_amount - Monthly rent amount
 * @param {boolean} params.is_disabled - Whether the apartment is disabled
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Updated apartment data
 */
const updateApartment = logMiddleware('ddb_updateApartment')(
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, is_disabled, updated_at, saas_tenant_id }) => {
    try {
      const command = new UpdateCommand({
        TableName: APARTMENTS_TABLE_NAME,
        Key: { apartment_id },
        UpdateExpression:
          'SET address = :address, unit_number = :unit_number, rooms_count = :rooms_count, rent_amount = :rent_amount, is_disabled = :is_disabled, updated_at = :updated_at',
        ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        ExpressionAttributeValues: {
          ':address': address,
          ':unit_number': unit_number,
          ':rooms_count': rooms_count,
          ':rent_amount': rent_amount,
          ':is_disabled': is_disabled,
          ':updated_at': updated_at,
          ':saas_tenant_id': saas_tenant_id,
        },
        ReturnValues: 'ALL_NEW',
      });

      const response = await ddbDocClient.send(command);
      return response.Attributes;
    } catch (error) {
      console.error('Error in ddb_updateApartment:', error);
      throw error;
    }
  }
);

/**
 * Deletes an apartment by its ID and tenant ID
 * @param {string} apartment_id - Unique identifier of the apartment
 * @param {string} saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} The deleted apartment data
 */
const deleteApartment = logMiddleware('ddb_deleteApartment')(async ({ apartment_id, saas_tenant_id }) => {
  try {
    const command = new DeleteCommand({
      TableName: APARTMENTS_TABLE_NAME,
      Key: { apartment_id },
      ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
      ExpressionAttributeValues: { ':saas_tenant_id': saas_tenant_id },
      ReturnValues: 'ALL_OLD',
    });

    const response = await ddbDocClient.send(command);
    if (!response.Attributes) throw new Error('Failed to delete apartment');

    return {
      apartment_id: response.Attributes.apartment_id,
    };
  } catch (error) {
    console.error('Error in ddb_deleteApartment:', error);
    throw error;
  }
});

// ============================================================================================
// Documents Management Functions
// ============================================================================================

/**
 * Create a new document in DynamoDB
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.apartment_id - ID of the apartment
 * @param {string} params.template_name - Name of the template to use
 * @param {Object} params.template_fields - Fields to populate in the template
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Object>} Created document
 */
const createDocument = logMiddleware('ddb_createDocument')(
  async ({ document_id, apartment_id, template_name, template_fields, created_at, saas_tenant_id }) => {
    try {
      const item = {
        document_id,
        apartment_id,
        template_name,
        template_fields,
        created_at,
        updated_at: created_at,
        saas_tenant_id,
      };
      await ddbDocClient.send(
        new PutCommand({
          TableName: DOCUMENTS_TABLE_NAME,
          Item: item,
        })
      );
      return item;
    } catch (error) {
      console.error('Error in ddb_createDocument:', error);
      throw error;
    }
  }
);

/**
 * Get a document by ID from DynamoDB
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Object>} Document data
 */
const getDocument = logMiddleware('ddb_getDocument')(async ({ document_id, saas_tenant_id }) => {
  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: DOCUMENTS_TABLE_NAME,
        Key: {
          document_id,
        },
        ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        ExpressionAttributeValues: {
          ':saas_tenant_id': saas_tenant_id,
        },
      })
    );
    return Item;
  } catch (error) {
    console.error('Error in ddb_getDocument:', error);
    throw error;
  }
});

/**
 * Get all documents for an apartment from DynamoDB
 * @param {string} apartment_id - ID of the apartment to fetch documents for
 * @param {string} saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Array>} List of documents sorted by updated_at in descending order
 */
const getApartmentDocuments = logMiddleware('ddb_getApartmentDocuments')(async ({ apartment_id, saas_tenant_id }) => {
  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: DOCUMENTS_TABLE_NAME,
        IndexName: 'ApartmentUpdatedIndex',
        KeyConditionExpression: 'apartment_id = :apartment_id',
        ExpressionAttributeValues: {
          ':apartment_id': apartment_id,
          ':saas_tenant_id': saas_tenant_id,
        },
        FilterExpression: 'saas_tenant_id = :saas_tenant_id',
        ScanIndexForward: false, // Sort in descending order by updated_at
      })
    );
    return Items || [];
  } catch (error) {
    console.error('Error in ddb_getApartmentDocuments:', error);
    throw error;
  }
});

/**
 * Get all documents for a tenant from DynamoDB
 * @param {string} tenant_user_id - ID of the tenant to fetch documents for
 * @param {string} saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Array>} List of documents sorted by updated_at in descending order
 */
const getTenantDocuments = logMiddleware('ddb_getTenantDocuments')(async ({ tenant_user_id, saas_tenant_id }) => {
  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: DOCUMENTS_TABLE_NAME,
        IndexName: 'TenantUpdatedIndex',
        KeyConditionExpression: 'tenant_user_id = :tenant_user_id',
        ExpressionAttributeValues: {
          ':tenant_user_id': tenant_user_id,
          ':saas_tenant_id': saas_tenant_id,
        },
        FilterExpression: 'saas_tenant_id = :saas_tenant_id',
        ScanIndexForward: false, // Sort in descending order by updated_at
      })
    );
    return Items || [];
  } catch (error) {
    console.error('Error in ddb_getTenantDocuments:', error);
    throw error;
  }
});

/**
 * Updates a document with new template fields and optionally assigns a tenant user id
 * @param {string} params.document_id - Document ID to update
 * @param {Object} params.template_fields - Updated template fields
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @param {string} [params.tenant_user_id] - ID of the tenant that resides in the property
 * @returns {Promise<Object>} Updated document
 */
const updateDocument = logMiddleware('ddb_updateDocument')(async ({ document_id, template_fields, saas_tenant_id, updated_at, tenant_user_id }) => {
  try {
    // Dynamically build UpdateExpression and ExpressionAttributeValues
    let updateExpr = 'SET template_fields = :fields, updated_at = :updated_at';
    const exprAttrValues = {
      ':fields': template_fields,
      ':updated_at': updated_at,
      ':saas_tenant_id': saas_tenant_id,
    };
    if (tenant_user_id) {
      updateExpr += ', tenant_user_id = :tenant_user_id';
      exprAttrValues[':tenant_user_id'] = tenant_user_id;
    }
    const { Attributes } = await ddbDocClient.send(
      new UpdateCommand({
        TableName: DOCUMENTS_TABLE_NAME,
        Key: { document_id },
        UpdateExpression: updateExpr,
        ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: 'ALL_NEW',
      })
    );
    return Attributes;
  } catch (error) {
    console.error('Error in ddb_updateDocument:', error);
    throw error;
  }
});

/**
 * Delete a document by ID
 * @param {string} document_id - UUID of the document to delete
 * @param {string} saas_tenant_id - SaaS tenant ID
 * @returns {Promise<string>} ID of the deleted document
 */
const deleteDocument = logMiddleware('ddb_deleteDocument')(async ({ document_id, saas_tenant_id }) => {
  const command = new DeleteCommand({
    TableName: DOCUMENTS_TABLE_NAME,
    Key: { document_id },
    ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
    ExpressionAttributeValues: { ':saas_tenant_id': saas_tenant_id },
    ReturnValues: 'ALL_OLD',
  });

  try {
    const result = await ddbClient.send(command);
    if (!result.Attributes) throw new Error('Document not found');

    return result.Attributes.document_id;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
});

// ============================================================================================
// Apartment activity Management Functions
// ============================================================================================

/**
 * Creates a new activity item of an apartment in DynamoDB
 * @param {Object} params
 * @param {string} params.activity_id - Unique identifier for the activity
 * @param {string} params.apartment_id - ID of the apartment associated with the activity
 * @param {string} params.description - Description of the activity
 * @param {boolean} [params.pending_confirmation] - Whether the activity requires confirmation
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @param {string} params.created_at - ISO timestamp of activity creation
 * @returns {Promise<Object>} Created activity data
 */
const createApartmentActivity = logMiddleware('ddb_createApartmentActivity')(
  async ({ activity_id, apartment_id, description, pending_confirmation, saas_tenant_id, created_at }) => {
    try {
      const item = {
        activity_id,
        apartment_id,
        description,
        pending_confirmation,
        created_at,
        saas_tenant_id,
      };

      await ddbDocClient.send(
        new PutCommand({
          TableName: ACTIVITY_TABLE_NAME,
          Item: item,
        })
      );

      return item;
    } catch (error) {
      console.error('Error in ddb_createApartmentActivity:', error);
      throw error;
    }
  }
);

/**
 * Retrieves all activity of an apartment from DynamoDB
 * @param {Object} params
 * @param {string} params.apartment_id - ID of the apartment
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Object>} ApartmentActivity data
 */
const getApartmentActivity = logMiddleware('ddb_getApartmentActivity')(async ({ apartment_id, saas_tenant_id }) => {
  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: ACTIVITY_TABLE_NAME,
        IndexName: 'ApartmentCreatedIndex',
        KeyConditionExpression: 'apartment_id = :apartment_id',
        ExpressionAttributeValues: {
          ':apartment_id': apartment_id,
          ':saas_tenant_id': saas_tenant_id,
        },
        FilterExpression: 'saas_tenant_id = :saas_tenant_id',
        ScanIndexForward: false, // Sort in descending order by created_at
        Limit: 10, // TODO: Add pagination support
      })
    );
    return Items || [];
  } catch (error) {
    console.error('Error in ddb_getApartmentActivity:', error);
    throw error;
  }
});

/**
 * Deletes an activity item of an apartment from DynamoDB
 * @param {Object} params
 * @param {string} params.activity_id - ID of the activity
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Object>} Deleted activity data
 */
const deleteApartmentActivity = logMiddleware('ddb_deleteApartmentActivity')(async ({ activity_id, saas_tenant_id }) => {
  try {
    const command = new DeleteCommand({
      TableName: ACTIVITY_TABLE_NAME,
      Key: { activity_id },
      ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
      ExpressionAttributeValues: { ':saas_tenant_id': saas_tenant_id },
      ReturnValues: 'ALL_OLD',
    });

    const response = await ddbDocClient.send(command);
    if (!response.Attributes) throw new Error('Failed to delete activity');

    return response.Attributes;
  } catch (error) {
    console.error('Error in ddb_deleteApartmentActivity:', error);
    throw error;
  }
});

// ============================================================================================
// SaaS Tenant Management Functions
// ============================================================================================

/**
 * Creates a new SaaS tenant in DynamoDB
 * @param {Object} params
 * @param {string} params.saas_tenant_id - Unique identifier for the tenant
 * @param {boolean} params.is_disabled - Whether the tenant is disabled
 * @param {string} params.created_at - ISO timestamp of tenant creation
 * @returns {Promise<Object>} Created tenant data
 */
const createSaasTenant = logMiddleware('ddb_createSaasTenant')(async ({ saas_tenant_id, is_disabled, created_at }) => {
  try {
    const item = {
      saas_tenant_id,
      is_disabled,
      created_at,
      updated_at: created_at,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: SAAS_TENANTS_TABLE_NAME,
        Item: item,
      })
    );

    return item;
  } catch (error) {
    console.error('Error in ddb_createSaasTenant:', error);
    throw error;
  }
});

/**
 * Updates a SaaS tenant in DynamoDB
 * @param {Object} params
 * @param {string} params.saas_tenant_id - ID of the tenant to update
 * @param {boolean} params.is_disabled - New disabled status
 * @returns {Promise<Object>} Updated tenant data
 */
const updateSaasTenant = logMiddleware('ddb_updateSaasTenant')(async ({ saas_tenant_id, is_disabled, updated_at }) => {
  try {
    const command = new UpdateCommand({
      TableName: SAAS_TENANTS_TABLE_NAME,
      Key: { saas_tenant_id },
      UpdateExpression: 'SET is_disabled = :is_disabled, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':is_disabled': is_disabled,
        ':updated_at': updated_at,
      },
      ReturnValues: 'ALL_NEW',
    });

    const response = await ddbDocClient.send(command);
    if (!response.Attributes) throw new Error('Failed to update tenant');

    return response.Attributes;
  } catch (error) {
    console.error('Error in ddb_updateSaasTenant:', error);
    throw error;
  }
});

/**
 * Deletes a SaaS tenant from DynamoDB
 * @param {Object} params
 * @param {string} params.saas_tenant_id - ID of the tenant to delete
 * @returns {Promise<Object>} Deleted tenant data
 */
const deleteSaasTenant = logMiddleware('ddb_deleteSaasTenant')(async ({ saas_tenant_id }) => {
  try {
    const command = new DeleteCommand({
      TableName: SAAS_TENANTS_TABLE_NAME,
      Key: { saas_tenant_id },
      ReturnValues: 'ALL_OLD',
    });

    const response = await ddbDocClient.send(command);
    if (!response.Attributes) throw new Error('Failed to delete tenant');

    return response.Attributes;
  } catch (error) {
    console.error('Error in ddb_deleteSaasTenant:', error);
    throw error;
  }
});

/**
 * Gets all SaaS tenants from DynamoDB
 * @returns {Promise<Array>} List of tenants
 */
const getSaasTenants = logMiddleware('ddb_getSaasTenants')(async () => {
  try {
    const { Items } = await ddbDocClient.send(
      new ScanCommand({
        TableName: SAAS_TENANTS_TABLE_NAME,
      })
    );
    return (Items || []).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); // Sort by updated_at desc
  } catch (error) {
    console.error('Error in ddb_getSaasTenants:', error);
    throw error;
  }
});

module.exports = {
  getApartmentsOfLandlord,
  createApartment,
  updateApartment,
  deleteApartment,
  createDocument,
  getDocument,
  getApartmentDocuments,
  getTenantDocuments,
  updateDocument,
  deleteDocument,
  createApartmentActivity,
  getApartmentActivity,
  deleteApartmentActivity,
  createSaasTenant,
  updateSaasTenant,
  deleteSaasTenant,
  getSaasTenants,
};
