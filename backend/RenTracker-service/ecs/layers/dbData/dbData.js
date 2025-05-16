// const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const gwData = require('./ddbData');
// const gwData = require('./pgData');
const cache = require('./cache');
const { logMiddleware } = require('./utils');

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

/**
 * Checks the health of the database
 * @returns {Promise<Date>} Current database timestamp
 */
const healthCheck = logMiddleware('healthCheck')(async () => {
  return await gwData.healthCheck();
});

// ============================================================================================
// Apartments Management Functions
// ============================================================================================

/**
 * Creates or updates an apartment in the system
 * @param {Object} params
 * @param {string} params.apartment_id - Apartment's unique identifier
 * @param {string} params.address - Apartment's address
 * @param {string} params.unit_number - Apartment's unit number
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {string} params.rent_amount - Apartment's rent amount
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created/updated apartment data
 */
const createApartment = logMiddleware('createApartment')(async ({ apartment_id, address, unit_number, rooms_count, rent_amount, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validatePositiveInteger(rent_amount);
  validateRoomsCount(rooms_count);
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.createApartment({ apartment_id, address, unit_number, rooms_count, rent_amount, created_at: new Date().toISOString(), saas_tenant_id });
});

/**
 * Gets all apartments for a given tenant
 * @param {Object} params
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of apartments
 */
const getAllApartments = logMiddleware('getAllApartments')(async ({ saas_tenant_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.getAllApartments({ saas_tenant_id });
});

/**
 * Updates an apartment's details
 * @param {Object} params
 * @param {string} params.apartment_id - Unique identifier for the apartment
 * @param {string} params.address - Building/house address
 * @param {string} params.unit_number - Unit number within the building
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {number} params.rent_amount - Monthly rent amount
 * @param {boolean} params.is_disabled - Whether the apartment is disabled
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Updated apartment data
 */
const updateApartment = logMiddleware('updateApartment')(
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, is_disabled, saas_tenant_id }) => {
    validateUUID(apartment_id, 'apartment_id');
    validateRoomsCount(rooms_count);
    validatePositiveInteger(rent_amount);
    validateBoolean(is_disabled, 'is_disabled');
    validateUUID(saas_tenant_id, 'saas_tenant_id');
    return await gwData.updateApartment({
      apartment_id,
      address,
      unit_number,
      rooms_count,
      rent_amount,
      is_disabled,
      updated_at: new Date().toISOString(),
      saas_tenant_id,
    });
  }
);

/**
 * Deletes an apartment from the system
 * @param {Object} params
 * @param {string} params.apartment_id - Apartment's unique identifier
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Deleted apartment data
 */
const deleteApartment = logMiddleware('deleteApartment')(async ({ apartment_id, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.deleteApartment({ apartment_id, saas_tenant_id });
});

// ============================================================================================
// Documents Management Functions
// ============================================================================================

/**
 * Create a new document
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.apartment_id - ID of the apartment
 * @param {string} params.template_name - Name of the template to use
 * @param {Object} params.template_fields - Fields to populate in the template
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Created document
 */
const createDocument = async ({ document_id, apartment_id, template_name, template_fields, saas_tenant_id }) => {
  validateUUID(document_id, 'document_id');
  validateUUID(apartment_id, 'apartment_id');
  validateNonEmptyString(template_name, 'template name');
  validateTemplateFields(template_fields);
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.createDocument({ document_id, apartment_id, template_name, template_fields, created_at: new Date().toISOString(), saas_tenant_id });
};

/**
 * Get a document by ID
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.senderUserId - The id of the user attempting the update.
 * @returns {Promise<Object>} Document data
 */
const getDocument = async ({ document_id, senderUserId }) => {
  validateUUID(document_id, 'document_id');
  validateUUID(senderUserId, 'senderUserId');

  return await gwData.getDocument({ document_id, senderUserId });
};

/**
 * Get all documents for a tenant
 * @param {Object} params
 * @param {string} params.tenant_user_id - ID of the tenant
 * @returns {Promise<Array>} List of documents
 */
const getTenantDocuments = async ({ tenant_user_id }) => {
  validateUUID(tenant_user_id, 'user_id');

  return await gwData.getTenantDocuments({ tenant_user_id });
};

/**
 * Update a document
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document
 * @param {Object} params.template_fields - Updated template fields
 * @param {string} params.senderUserId - The id of the user attempting the update.
 * @param {string} [params.tenantUserId] - ID of the apartment tenant (not related to the SaaS Tenant Id, which is the landlord).
 * @returns {Promise<Object>} Updated document
 */
const updateDocument = async ({ document_id, template_fields, senderUserId, tenantUserId }) => {
  validateUUID(document_id, 'document_id');
  validateTemplateFields(template_fields);
  validateUUID(senderUserId, 'senderUserId');
  if (tenantUserId) validateUUID(tenantUserId, 'user_id');

  const updateParams = { document_id, template_fields, updated_at: new Date().toISOString(), senderUserId };
  if (tenantUserId) updateParams.tenantUserId = tenantUserId;
  return await gwData.updateDocument(updateParams);
};

/**
 * Delete a document by ID
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document to delete
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<string>} ID of the deleted document
 */
const deleteDocument = async ({ document_id, saas_tenant_id }) => {
  validateUUID(document_id, 'document_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.deleteDocument({ document_id, saas_tenant_id });
};

// ============================================================================================
// Apartment activity Management Functions
// ============================================================================================

/**
 * Creates a new activity in the system
 * @param {Object} params
 * @param {string} params.activity_id - Unique identifier for the activity
 * @param {string} params.apartment_id - ID of the apartment associated with the activity
 * @param {string} params.description - Description of the activity
 * @param {boolean} [params.pending_confirmation] - Whether the activity requires confirmation
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created activity data
 */
const createApartmentActivity = logMiddleware('createApartmentActivity')(
  async ({ activity_id, apartment_id, description, pending_confirmation, saas_tenant_id }) => {
    validateUUID(activity_id, 'activity_id');
    validateUUID(apartment_id, 'apartment_id');
    validateNonEmptyString(description, 'description');
    validateUUID(saas_tenant_id, 'saas_tenant_id');

    return await gwData.createApartmentActivity({
      activity_id,
      apartment_id,
      description,
      pending_confirmation,
      created_at: new Date().toISOString(),
      saas_tenant_id,
    });
  }
);

/**
 * Deletes an activity from the system
 * @param {Object} params
 * @param {string} params.activity_id - ID of the activity
 * @param {string} params.saas_tenant_id - SaaS tenant ID
 * @returns {Promise<Object>} Deleted activity data
 */
const deleteApartmentActivity = logMiddleware('deleteApartmentActivity')(async ({ activity_id, saas_tenant_id }) => {
  validateUUID(activity_id, 'activity_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.deleteApartmentActivity({ activity_id, saas_tenant_id });
});

// ============================================================================================
// SaaS Tenant Management Functions
// ============================================================================================

/**
 * Creates a new SaaS tenant in the system
 * @param {Object} params
 * @param {string} params.saas_tenant_id - Unique identifier for the tenant
 * @param {boolean} params.is_disabled - Whether the tenant is disabled
 * @returns {Promise<Object>} Created tenant data
 */
const createSaasTenant = async ({ saas_tenant_id, is_disabled, email, name, phone, address, israeli_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  validateBoolean(is_disabled, 'is_disabled');
  validateEmail(email, 'email');
  validateNonEmptyString(name, 'name');
  validateNonEmptyString(phone, 'phone');
  validateNonEmptyString(address, 'address');
  validateNonEmptyString(israeli_id, 'israeli_id');

  return await gwData.createSaasTenant({
    saas_tenant_id,
    is_disabled,
    created_at: new Date().toISOString(),
    email,
    name,
    phone,
    address,
    israeli_id,
  });
};

/**
 * Updates a SaaS tenant in the system
 * @param {Object} params
 * @param {string} params.saas_tenant_id - Unique identifier for the tenant
 * @param {boolean} params.is_disabled - Whether the tenant is disabled
 * @returns {Promise<Object>} Updated tenant data
 */
const updateSaasTenant = async ({ saas_tenant_id, is_disabled, email, name, phone, address, israeli_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  validateBoolean(is_disabled, 'is_disabled');
  validateEmail(email, 'email');
  validateNonEmptyString(name, 'name');
  validateNonEmptyString(phone, 'phone');
  validateNonEmptyString(address, 'address');
  validateNonEmptyString(israeli_id, 'israeli_id');

  await invalidation_getSaasTenants(saas_tenant_id);
  return await gwData.updateSaasTenant({
    saas_tenant_id,
    is_disabled,
    email,
    name,
    phone,
    address,
    israeli_id,
    updated_at: new Date().toISOString(),
  });
};

/**
 * Deletes a SaaS tenant from the system
 * @param {Object} params
 * @param {string} params.saas_tenant_id - ID of the tenant to delete
 * @returns {Promise<Object>} Deleted tenant data
 */
const deleteSaasTenant = async ({ saas_tenant_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  await invalidation_getSaasTenants(saas_tenant_id);
  return await gwData.deleteSaasTenant({ saas_tenant_id });
};

// ============================================================================================
// Cache wrapper functions
// ============================================================================================
const cache_getApartmentsOfLandlord = async ({ saas_tenant_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get(`getApartmentsOfLandlord(${saas_tenant_id})`, () => gwData.getApartmentsOfLandlord({ saas_tenant_id }));
};

const cache_getApartmentActivity = async ({ apartment_id, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get(`getApartmentActivity(${apartment_id})`, () => gwData.getApartmentActivity({ apartment_id, saas_tenant_id }));
};

const cache_getApartmentDocuments = async ({ apartment_id, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get(`getApartmentDocuments(${apartment_id})`, () => gwData.getApartmentDocuments({ apartment_id, saas_tenant_id }));
};

const cache_getSaasTenants = async ({ connectedUserId }) => {
  // Cache saas tenants only for non-admin users, since every specific user invalidation would also invalidate by definition the cache of all saas tenants, and admin doesn't worth the effort - the usage isn't expected to high enough, and we'll need pagination anyway.
  return connectedUserId && connectedUserId !== ADMIN_USER_ID
    ? await cache.get(`getSaasTenants(${connectedUserId || ''})`, () => gwData.getSaasTenants({ connectedUserId }))
    : await gwData.getSaasTenants({}); // otherwise get all saas tenants, without caching.
};
const invalidation_getSaasTenants = (userId) => {
  // cache_getSaasTenants caches saas tenants only for non-admin users ...
  if (userId && userId !== ADMIN_USER_ID) cache.invalidateGet(`getSaasTenants(${userId})`);
};

module.exports = {
  healthCheck,
  createApartment,
  updateApartment,
  deleteApartment,
  getAllApartments,
  createDocument,
  getDocument,
  getTenantDocuments,
  updateDocument,
  deleteDocument,
  createApartmentActivity,
  deleteApartmentActivity,
  createSaasTenant,
  updateSaasTenant,
  deleteSaasTenant,
  cache: {
    getApartmentsOfLandlord: cache_getApartmentsOfLandlord,
    getApartmentActivity: cache_getApartmentActivity,
    getApartmentDocuments: cache_getApartmentDocuments,
    getSaasTenants: cache_getSaasTenants,
    invalidation: {
      getApartmentsOfLandlord: (saas_tenant_id) =>
        saas_tenant_id
          ? cache.invalidateGet(`getApartmentsOfLandlord(${saas_tenant_id})`)
          : console.warn('saas_tenant_id is undefined, cannot invalidate cache for getApartmentsOfLandlord()'),
      getApartmentDocuments: (apartment_id) =>
        apartment_id
          ? cache.invalidateGet(`getApartmentDocuments(${apartment_id})`)
          : console.warn('apartment_id is undefined, cannot invalidate cache for getApartmentDocuments()'),
      getApartmentActivity: (apartment_id) =>
        apartment_id
          ? cache.invalidateGet(`getApartmentActivity(${apartment_id})`)
          : console.warn('apartment_id is undefined, cannot invalidate cache for getApartmentActivity()'),
    },
  },
};

//=============================================================================================================================================
// Generic validation functions
//=============================================================================================================================================

/**
 * Validates if the given ID is a valid UUID.
 * @param {string} id - The ID to validate.
 * @param {string} fieldName - The name of the field being validated.
 * @throws {Error} If the ID is not a valid UUID.
 */
function validateUUID(id, fieldName) {
  if (!id || typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    throw new Error(`Invalid ${fieldName}: Must be a valid UUID`);
  }
}

/**
 * Validates if the given value is a non-empty string.
 * @param {string} value - The value to validate.
 * @param {string} fieldName - The name of the field being validated.
 * @throws {Error} If the value is not a non-empty string.
 */
function validateNonEmptyString(value, fieldName) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: Must be a non-empty string`);
  }
}

/**
 * Validates if the given email is in a valid format.
 * @param {string} email - The email to validate.
 * @throws {Error} If the email is not in a valid format.
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Invalid email: Must be a valid email address');
  }
}

function validatePositiveInteger(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount: Must be a positive number');
  }
}

function validateRoomsCount(rooms_count) {
  if (typeof rooms_count !== 'number' || isNaN(rooms_count) || rooms_count <= 0 || rooms_count % 0.5 !== 0) {
    throw new Error('Invalid rooms_count: Must be a positive number in increments of 0.5');
  }
}

function validateBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${fieldName}: Must be a boolean`);
  }
}

/**
 * Validates if the given value is a valid HTTP(S) URL.
 * @param {string} url - The URL to validate.
 * @param {string} fieldName - The name of the field being validated.
 * @throws {Error} If the value is not a valid HTTP(S) URL.
 */
function validateHttpUrl(url, fieldName) {
  if (!url || typeof url !== 'string' || !url.match(/^https?:\/\/.+/)) {
    throw new Error(`Invalid ${fieldName}: Must be a valid HTTP(S) URL`);
  }
}

function validateRentalAgreementFields(fields) {
  const requiredFields = {
    // Property Details
    room_count: { type: 'number', required: true, min: 1, max: 20 },
    property_address: { type: 'string', required: true },
    included_equipment: { type: 'string', required: false },
    included_services: { type: 'string', required: false },

    // Lease Terms
    date: { type: 'string', required: true, format: 'date' },
    lease_period: { type: 'number', required: true, min: 1 },
    rent_amount: { type: 'number', required: true, min: 0 },
    start_date: { type: 'string', required: true, format: 'date' },
    end_date: { type: 'string', required: true, format: 'date' },
    initial_payment_months: { type: 'string', required: true, min: 1 },
    payment_day: { type: 'number', required: true, min: 1, max: 31 },
    standing_order_start: { type: 'string', required: true, format: 'date' },

    // Utility Limits
    water_limit: { type: 'number', required: false, min: 0 },
    electricity_limit: { type: 'number', required: false, min: 0 },

    // Tenant Details
    tenant_name: { type: 'string', required: true },
    tenant_id: { type: 'string', required: true, format: 'israeli-id' },
    tenant_address: { type: 'string', required: true },
    tenant_phone: { type: 'string', required: true, format: 'israeli-phone' },
    tenant_email: { type: 'string', required: true, format: 'email' },

    // Security and Guarantees
    security_deposit: { type: 'number', required: true, min: 0 },

    // Guarantor Details
    guarantor_name: { type: 'string', required: false },
    guarantor_id: { type: 'string', required: false, format: 'israeli-id' },
    guarantor_address: { type: 'string', required: false },
    guarantor_phone: { type: 'string', required: false, format: 'israeli-phone' },
  };

  // Helper functions for validation
  const isValidDate = (dateStr) => !isNaN(new Date(dateStr).getTime());
  const isValidIsraeliId = (id) => /^\d{9}$/.test(id);
  const isValidIsraeliPhone = (phone) => /^(\+972|0)([23489]|5[0-9]|77)[0-9]{7}$/.test(phone);

  // Validate each field
  for (const [field, rules] of Object.entries(requiredFields)) {
    const value = fields[field];

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Missing required field: ${field}`);
    }

    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation
    if (rules.type === 'number' && typeof value !== 'number') {
      throw new Error(`Field ${field} must be a number`);
    }
    if (rules.type === 'string' && typeof value !== 'string') {
      throw new Error(`Field ${field} must be a string`);
    }

    // Range validation for numbers
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        throw new Error(`Field ${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        throw new Error(`Field ${field} must be at most ${rules.max}`);
      }
    }

    // Format validation
    if (rules.format) {
      switch (rules.format) {
        case 'date':
          if (!isValidDate(value)) {
            throw new Error(`Invalid date format for field ${field}`);
          }
          break;
        case 'israeli-id':
          if (!isValidIsraeliId(value)) {
            throw new Error(`Invalid Israeli ID format for field ${field}`);
          }
          break;
        case 'israeli-phone':
          if (!isValidIsraeliPhone(value)) {
            throw new Error(`Invalid Israeli phone format for field ${field}`);
          }
          break;
      }
    }
  }
}

function validateTemplateFields(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new Error('Invalid template_fields: Must be an object');
  }

  // Validate based on template type
  if (fields.template_name === 'rental_agreement') {
    validateRentalAgreementFields(fields);
  }
}
