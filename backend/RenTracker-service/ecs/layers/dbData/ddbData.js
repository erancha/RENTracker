const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { logMiddleware, isLandlordUser } = require('./utils');

const ddbClient = new DynamoDBClient({ region: process.env.APP_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// const LANDLORDS_TABLE_NAME = process.env.LANDLORDS_TABLE_NAME; // LandlordsTable and TenantsTable serve no purpose in the current stack-per-landlord model ..
// const TENANTS_TABLE_NAME = process.env.TENANTS_TABLE_NAME; // LandlordsTable and TenantsTable serve no purpose in the current stack-per-landlord model ..
const APARTMENTS_TABLE_NAME = process.env.APARTMENTS_TABLE_NAME;
const DOCUMENTS_TABLE_NAME = process.env.DOCUMENTS_TABLE_NAME;
const ACTIVITY_TABLE_NAME = process.env.ACTIVITY_TABLE_NAME;

/**
 * Creates or updates a user in DynamoDB
 * @param {string} user_id - User's unique identifier
 * @param {string} user_name - User's display name
 * @param {string} email - User's email address
 * @param {string} phone_number - User's phone number
 * @param {string} saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created user data with operation status
 */
const upsertUser = logMiddleware('ddb_upsertUser')(async ({ user_id, user_name, email, phone_number, saas_tenant_id }) => {
  // const isLandlord = isLandlordUser({ user_id, saas_tenant_id });
  // const userItem = {
  //   saas_tenant_id,
  //   ...(isLandlord ? { landlord_id: user_id } : { tenant_id: user_id }),
  //   full_name: user_name,
  //   email,
  //   phone_number: phone_number || '',
  //   created_at: new Date().toISOString(),
  //   updated_at: new Date().toISOString(),
  // };
  // try {
  //   await ddbDocClient.send(
  //     new PutCommand({
  //       TableName: isLandlord ? LANDLORDS_TABLE_NAME : TENANTS_TABLE_NAME,
  //       Item: userItem,
  //     })
  //   );
  //   return {
  //     ...userItem,
  //     operation: 'created', // DynamoDB PutItem always overwrites, so we consider it a creation
  //   };
  // } catch (error) {
  //   console.error('Error in ddb_upsertUser:', error);
  //   throw error;
  // }
});

/**
 * Creates a new apartment in DynamoDB
 * @param {Object} params
 * @param {string} params.apartment_id - Unique identifier of the apartment
 * @param {string} params.address - Physical address of the apartment
 * @param {string} params.unit_number - Unit number within the building
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {number} params.rent_amount - Monthly rent amount
 * @param {string} params.landlord_id - ID of the landlord
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created apartment data
 */
const createApartment = logMiddleware('ddb_createApartment')(
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, landlord_id, saas_tenant_id }) => {
    try {
      const item = {
        apartment_id,
        saas_tenant_id,
        landlord_id,
        address,
        unit_number,
        rooms_count,
        rent_amount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
const getApartmentsOfLandlord = logMiddleware('ddb_getApartmentsOfLandlord')(async ({ user_id, saas_tenant_id }) => {
  try {
    const { Items } = await ddbDocClient.send(
      new QueryCommand({
        TableName: APARTMENTS_TABLE_NAME,
        IndexName: 'SaaSTenantUpdatedIndex',
        KeyConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        FilterExpression: 'landlord_id = :user_id',
        ExpressionAttributeValues: {
          ':user_id': user_id,
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
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, is_disabled, saas_tenant_id }) => {
    try {
      const command = new UpdateCommand({
        TableName: APARTMENTS_TABLE_NAME,
        Key: {
          apartment_id,
        },
        UpdateExpression:
          'SET address = :address, unit_number = :unit_number, rooms_count = :rooms_count, rent_amount = :rent_amount, is_disabled = :is_disabled, updated_at = :now',
        ConditionExpression: 'saas_tenant_id = :saas_tenant_id',
        ExpressionAttributeValues: {
          ':address': address,
          ':unit_number': unit_number,
          ':rooms_count': rooms_count,
          ':rent_amount': rent_amount,
          ':is_disabled': is_disabled,
          ':now': new Date().toISOString(),
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
      landlord_id: response.Attributes.landlord_id,
    };
  } catch (error) {
    console.error('Error in ddb_deleteApartment:', error);
    throw error;
  }
});

/**
 * Create a new document in DynamoDB
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.apartment_id - ID of the apartment
 * @param {string} params.template_name - Name of the template to use
 * @param {Object} params.template_fields - Fields to populate in the template
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @param {string} params.pdf_url - URL of the PDF document
 * @returns {Promise<Object>} Created document
 */
const createDocument = logMiddleware('ddb_createDocument')(async ({ document_id, apartment_id, template_name, template_fields, saas_tenant_id, pdf_url }) => {
  try {
    const item = {
      document_id,
      apartment_id,
      template_name,
      template_fields,
      pdf_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
});

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
 * Updates a document with new template fields and optionally assigns a tenant and pdf_url
 * @param {string} params.document_id - Document ID to update
 * @param {Object} params.template_fields - Updated template fields
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @param {string} [params.tenant_user_id] - ID of the tenant that resides in the property
 * @param {string} [params.pdf_url] - URL of the PDF document
 * @returns {Promise<Object>} Updated document
 */
const updateDocument = logMiddleware('ddb_updateDocument')(async ({ document_id, template_fields, saas_tenant_id, tenant_user_id, pdf_url }) => {
  try {
    // Dynamically build UpdateExpression and ExpressionAttributeValues
    let updateExpr = 'SET template_fields = :fields, updated_at = :now';
    const exprAttrValues = {
      ':fields': template_fields,
      ':now': new Date().toISOString(),
      ':saas_tenant_id': saas_tenant_id,
    };
    if (tenant_user_id) {
      updateExpr += ', tenant_user_id = :tenant_user_id';
      exprAttrValues[':tenant_user_id'] = tenant_user_id;
    }
    if (pdf_url) {
      updateExpr += ', pdf_url = :pdf_url';
      exprAttrValues[':pdf_url'] = pdf_url;
    }
    const { Attributes } = await ddbDocClient.send(
      new UpdateCommand({
        TableName: DOCUMENTS_TABLE_NAME,
        Key: {
          document_id,
        },
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

module.exports = {
  upsertUser,
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
};
