// const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const gwData = require('./ddbData');
// const gwData = require('./pgData');
const cache = require('./cache');
const { logMiddleware, isLandlordUser } = require('./utils');

/**
 * Checks the health of the database
 * @returns {Promise<Date>} Current database timestamp
 */
const healthCheck = logMiddleware('healthCheck')(async () => {
  return await gwData.healthCheck();
});

/**
 * Creates or updates a user in the system
 * @param {Object} params
 * @param {string} params.user_id - User's unique identifier
 * @param {string} params.user_name - User's display name
 * @param {string} params.email - User's email address
 * @param {string} params.phone_number - User's phone number
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created/updated user data
 */
const upsertUser = logMiddleware('upsertUser')(async ({ user_id, user_name, email, phone_number, saas_tenant_id }) => {
  validateUUID(user_id, 'user_id');
  validateNonEmptyString(user_name, 'user_name');
  validateEmail(email);
  validatePhoneNumber(phone_number);
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.upsertUser({ user_id, user_name, email, phone_number, saas_tenant_id });
});

/**
 * Retrieves all users for a given SaaS tenant
 * @param {Object} params
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of users
 */
const getAllUsers = logMiddleware('getAllUsers')(async ({ saas_tenant_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.getAllUsers({ saas_tenant_id });
});

/**
 * Creates or updates an apartment in the system
 * @param {Object} params
 * @param {string} params.apartment_id - Apartment's unique identifier
 * @param {string} params.address - Apartment's address
 * @param {string} params.unit_number - Apartment's unit number
 * @param {number} params.rooms_count - Number of rooms in the apartment
 * @param {string} params.rent_amount - Apartment's rent amount
 * @param {string} params.landlord_id - Landlord's unique identifier
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Object>} Created/updated apartment data
 */
const createApartment = logMiddleware('createApartment')(
  async ({ apartment_id, address, unit_number, rooms_count, rent_amount, landlord_id, saas_tenant_id }) => {
    validateUUID(apartment_id, 'apartment_id');
    validatePositiveInteger(rent_amount);
    validateRoomsCount(rooms_count);
    validateUUID(landlord_id, 'user_id');
    validateUUID(saas_tenant_id, 'saas_tenant_id');
    return await gwData.createApartment({ apartment_id, address, unit_number, rooms_count, rent_amount, landlord_id, saas_tenant_id });
  }
);

/**
 * Retrieves all apartments owned by a specific user
 * @param {Object} params
 * @param {string} params.user_id - User's unique identifier
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of apartments
 */
const getApartmentsOfLandlord = logMiddleware('getApartmentsOfLandlord')(async ({ user_id, saas_tenant_id }) => {
  validateUUID(user_id, 'user_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await gwData.getApartmentsOfLandlord({ user_id, saas_tenant_id });
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
    return await gwData.updateApartment({ apartment_id, address, unit_number, rooms_count, rent_amount, is_disabled, saas_tenant_id });
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

// Document Management Functions

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

  return await gwData.createDocument({ document_id, apartment_id, template_name, template_fields, saas_tenant_id });
};

/**
 * Get a document by ID
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Document data
 */
const getDocument = async ({ document_id, saas_tenant_id }) => {
  validateUUID(document_id, 'document_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.getDocument({ document_id, saas_tenant_id });
};

/**
 * Get all documents for an apartment
 * @param {Object} params
 * @param {string} params.apartment_id - ID of the apartment
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Array>} List of documents
 */
const getApartmentDocuments = async ({ apartment_id, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.getApartmentDocuments({ apartment_id, saas_tenant_id });
};

/**
 * Get all documents for a tenant
 * @param {Object} params
 * @param {string} params.tenant_user_id - ID of the tenant
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Array>} List of documents
 */
const getTenantDocuments = async ({ tenant_user_id, saas_tenant_id }) => {
  validateUUID(tenant_user_id, 'user_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');

  return await gwData.getTenantDocuments({ tenant_user_id, saas_tenant_id });
};

/**
 * Update a document
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document
 * @param {Object} params.template_fields - Updated template fields
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @param {string} [params.tenant_user_id] - ID of the tenant that resides in the property (not related to saasTenantId)
 * @returns {Promise<Object>} Updated document
 */
const updateDocument = async ({ document_id, template_fields, saas_tenant_id, tenant_user_id }) => {
  validateUUID(document_id, 'document_id');
  validateTemplateFields(template_fields);
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  if (tenant_user_id) validateUUID(tenant_user_id, 'user_id');

  const updateParams = { document_id, template_fields, saas_tenant_id };
  if (tenant_user_id) updateParams.tenant_user_id = tenant_user_id;
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

// Cache wrapper functions
const cache_getAllUsers = async ({ saas_tenant_id }) => {
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get('getAllUsers()', () => getAllUsers({ saas_tenant_id }));
};

const cache_getApartmentsOfLandlord = async ({ user_id, saas_tenant_id }) => {
  validateUUID(user_id, 'user_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get(`getApartmentsOfLandlord(${user_id})`, () => getApartmentsOfLandlord({ user_id, saas_tenant_id }));
};

const cache_getApartmentActivity = async ({ apartment_id, saas_tenant_id }) => {
  validateUUID(apartment_id, 'apartment_id');
  validateUUID(saas_tenant_id, 'saas_tenant_id');
  return await cache.get(`getApartmentActivity(${apartment_id})`, () => gwData.getApartmentActivity({ apartment_id, saas_tenant_id }));
};

module.exports = {
  isLandlordUser,
  healthCheck,
  upsertUser,
  getAllUsers,
  createApartment,
  updateApartment,
  deleteApartment,
  getApartmentsOfLandlord,
  getAllApartments,
  createDocument,
  getDocument,
  getApartmentDocuments,
  getTenantDocuments,
  updateDocument,
  deleteDocument,
  createApartmentActivity,
  deleteApartmentActivity,

  // Cache interface
  cache: {
    getAllUsers: cache_getAllUsers,
    getApartmentsOfLandlord: cache_getApartmentsOfLandlord,
    getApartmentActivity: cache_getApartmentActivity,
    invalidation: {
      getAllUsers: () => cache.invalidateGet('getAllUsers()'),
      getApartmentsOfLandlord: (user_id) =>
        user_id
          ? cache.invalidateGet(`getApartmentsOfLandlord(${user_id})`)
          : console.warn('user_id is undefined, cannot invalidate cache for getApartmentsOfLandlord()'),
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
    // Basic Information
    city: { type: 'string', required: true },
    date: { type: 'string', required: true, format: 'date' },

    // Landlord Details
    landlord_name: { type: 'string', required: true },
    landlord_id: { type: 'string', required: true, format: 'israeli-id' },
    landlord_address: { type: 'string', required: true },
    landlord_phone: { type: 'string', required: true, format: 'israeli-phone' },

    // Tenant Details
    tenant_name: { type: 'string', required: true },
    tenant_id: { type: 'string', required: true, format: 'israeli-id' },
    tenant_address: { type: 'string', required: true },
    tenant_phone: { type: 'string', required: true, format: 'israeli-phone' },
    tenant_email: { type: 'string', required: true, format: 'email' },

    // Property Details
    room_count: { type: 'number', required: true, min: 1, max: 20 },
    property_address: { type: 'string', required: true },
    included_equipment: { type: 'string', required: false },
    included_services: { type: 'string', required: false },

    // Lease Terms
    lease_period: { type: 'number', required: true, min: 1 },
    start_date: { type: 'string', required: true, format: 'date' },
    end_date: { type: 'string', required: true, format: 'date' },

    // Financial Terms
    rent_amount: { type: 'number', required: true, min: 0 },
    payment_day: { type: 'number', required: true, min: 1, max: 31 },
    initial_payment_months: { type: 'string', required: true, min: 1 },
    standing_order_start: { type: 'string', required: true, format: 'date' },

    // Utility Limits
    water_limit: { type: 'number', required: false, min: 0 },
    electricity_limit: { type: 'number', required: false, min: 0 },

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
