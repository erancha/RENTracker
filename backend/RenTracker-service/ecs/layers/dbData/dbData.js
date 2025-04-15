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
  validateUserId(user_id);
  validateUserName(user_name);
  validateEmail(email);
  validatePhoneNumber(phone_number);
  validateSaaSTenantId(saas_tenant_id);
  return await gwData.upsertUser({ user_id, user_name, email, phone_number, saas_tenant_id });
});

/**
 * Retrieves all users for a given SaaS tenant
 * @param {Object} params
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of users
 */
const getAllUsers = logMiddleware('getAllUsers')(async ({ saas_tenant_id }) => {
  validateSaaSTenantId(saas_tenant_id);
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
    validateApartmentId(apartment_id);
    validateAmount(rent_amount);
    validateRoomsCount(rooms_count);
    validateUserId(landlord_id);
    validateSaaSTenantId(saas_tenant_id);
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
  validateUserId(user_id);
  validateSaaSTenantId(saas_tenant_id);
  return await gwData.getApartmentsOfLandlord({ user_id, saas_tenant_id });
});

/**
 * Gets all apartments for a given tenant
 * @param {Object} params
 * @param {string} params.saas_tenant_id - SaaS tenant identifier
 * @returns {Promise<Array>} List of apartments
 */
const getAllApartments = logMiddleware('getAllApartments')(async ({ saas_tenant_id }) => {
  validateSaaSTenantId(saas_tenant_id);
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
    validateApartmentId(apartment_id);
    validateRoomsCount(rooms_count);
    validateAmount(rent_amount);
    validateIsDisabled(is_disabled);
    validateSaaSTenantId(saas_tenant_id);
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
  validateApartmentId(apartment_id);
  validateSaaSTenantId(saas_tenant_id);
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
  validateDocumentId(document_id);
  validateApartmentId(apartment_id);
  validateTemplateName(template_name);
  validateTemplateFields(template_fields);
  validateSaaSTenantId(saas_tenant_id);

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
  validateDocumentId(document_id);
  validateSaaSTenantId(saas_tenant_id);

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
  validateApartmentId(apartment_id);
  validateSaaSTenantId(saas_tenant_id);

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
  validateUserId(tenant_user_id);
  validateSaaSTenantId(saas_tenant_id);

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
  validateDocumentId(document_id);
  validateTemplateFields(template_fields);
  validateSaaSTenantId(saas_tenant_id);
  if (tenant_user_id) validateUserId(tenant_user_id);

  return await gwData.updateDocument({ document_id, template_fields, saas_tenant_id, tenant_user_id });
};

/**
 * Delete a document by ID
 * @param {Object} params
 * @param {string} params.document_id - UUID of the document to delete
 * @param {string} params.saas_tenant_id - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<string>} ID of the deleted document
 */
const deleteDocument = async ({ document_id, saas_tenant_id }) => {
  validateDocumentId(document_id);
  validateSaaSTenantId(saas_tenant_id);

  return await gwData.deleteDocument({ document_id, saas_tenant_id });
};

// Cache wrapper functions
const cache_getAllUsers = async ({ saas_tenant_id }) => {
  validateSaaSTenantId(saas_tenant_id);
  return await cache.get('getAllUsers()', () => getAllUsers({ saas_tenant_id }));
};

const cache_getApartmentsOfLandlord = async ({ user_id, saas_tenant_id }) => {
  validateUserId(user_id);
  validateSaaSTenantId(saas_tenant_id);
  return await cache.get(`getApartmentsOfLandlord(${user_id})`, () => getApartmentsOfLandlord({ user_id, saas_tenant_id }));
};

const cache_getPayments = async ({ apartment_id, saas_tenant_id }) => {
  validateApartmentId(apartment_id);
  validateSaaSTenantId(saas_tenant_id);
  return await cache.get(`getPayments(${apartment_id})`, () => gwData.getPayments({ apartment_id, saas_tenant_id }));
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

  // Cache interface
  cache: {
    getAllUsers: cache_getAllUsers,
    getApartmentsOfLandlord: cache_getApartmentsOfLandlord,
    getPayments: cache_getPayments,
    invalidation: {
      getAllUsers: () => cache.invalidateGet('getAllUsers()'),
      getApartmentsOfLandlord: (user_id) => cache.invalidateGet(`getApartmentsOfLandlord(${user_id})`),
      getPayments: (apartment_id) => cache.invalidateGet(`getPayments(${apartment_id})`),
    },
  },
};

// Validation functions
function validateUserId(user_id) {
  if (!user_id || typeof user_id !== 'string' || user_id.trim().length === 0) {
    throw new Error('Invalid user_id: Must be a non-empty string');
  }
}

function validateUserName(user_name) {
  if (!user_name || typeof user_name !== 'string' || user_name.trim().length === 0) {
    throw new Error('Invalid user_name: Must be a non-empty string');
  }
}

function validateEmail(email) {
  if (!email || typeof email !== 'string' || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid email_address: Must be a valid email format');
  }
}

function validateSaaSTenantId(saas_tenant_id) {
  if (!saas_tenant_id || typeof saas_tenant_id !== 'string' || saas_tenant_id.trim().length === 0) {
    throw new Error('Invalid tenant_id: Must be a non-empty string');
  }
}

function validateApartmentId(apartment_id) {
  if (!apartment_id || typeof apartment_id !== 'string' || apartment_id.trim().length === 0) {
    throw new Error('Invalid apartment_id: Must be a non-empty string');
  }
}

function validateAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount: Must be a positive number');
  }
}

function validateRoomsCount(rooms_count) {
  if (typeof rooms_count !== 'number' || isNaN(rooms_count) || rooms_count <= 0 || (rooms_count % 0.5 !== 0)) {
    throw new Error('Invalid rooms_count: Must be a positive number in increments of 0.5');
  }
}

function validateIsDisabled(is_disabled) {
  if (typeof is_disabled !== 'boolean') {
    throw new Error('Invalid is_disabled: Must be a boolean');
  }
}

function validateDocumentId(document_id) {
  if (!document_id || typeof document_id !== 'string') {
    throw new Error('Invalid document ID');
  }
}

function validateTemplateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error(`Invalid template name: ${name}`);
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

/**
 * Validates a phone number
 * @param {string} phone_number - Phone number to validate
 * @throws {Error} If phone number is invalid
 */
function validatePhoneNumber(phone_number) {
  if (phone_number && typeof phone_number !== 'string') {
    throw new Error('Phone number must be a string');
  }
  if (phone_number && !phone_number.match(/^\+?[1-9]\d{1,14}$/)) {
    throw new Error('Invalid phone number format. Must follow E.164 format (e.g., +972501234567)');
  }
}
