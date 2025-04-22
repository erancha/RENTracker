const { v4: uuidv4 } = require('uuid');
const { prepareCorsHeaders } = require('/opt/corsHeaders');
const dbData = require('/opt/dbData');
const { prepareS3DocumentFolderKey, prepareS3Keys } = require('/opt/prepareS3Keys');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const APP_AWS_REGION = process.env.APP_AWS_REGION;
const SAAS_TENANT_ID = process.env.SAAS_TENANT_ID;
const DOCUMENTS_CLOUDFRONT_DOMAIN = process.env.DOCUMENTS_CLOUDFRONT_DOMAIN;
const DOCUMENTS_BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;

//=============================================================================================================================================
// Main REST handler
//=============================================================================================================================================
exports.handler = async (event) => {
  // console.log(JSON.stringify(event, null, 2));
  const corsHeaders = prepareCorsHeaders(event.headers?.origin);

  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Verify that we have a valid authenticated request
    if (!event.requestContext.authorizer) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Unauthorized request',
        }),
      };
    }

    const { httpMethod, path } = event;

    // Route to appropriate handler based on method and path
    if (path === '/documents') {
      switch (httpMethod) {
        case 'POST':
          return await handleCreateDocument(event, corsHeaders);
        case 'GET':
          return event.queryStringParameters?.tenantUserId
            ? await handleGetTenantDocuments(event, corsHeaders)
            : await handleGetApartmentDocuments(event, corsHeaders);
      }
    } else if (path.startsWith('/documents/')) {
      const documentId = path.split('/')[2];
      switch (httpMethod) {
        case 'GET':
          if (path.endsWith('/pdf')) {
            return await handleGetDocumentPdf(documentId, corsHeaders);
          }
          return await handleGetDocument(documentId, corsHeaders);
        case 'PUT':
          return await handleUpdateDocument(documentId, event, corsHeaders);
        case 'DELETE':
          return await handleDeleteDocument(documentId, corsHeaders);
      }
    } else if (path === '/upload' && httpMethod === 'POST') {
      return await handleFileUpload(event, corsHeaders);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Not Found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

//=============================================================================================================================================
// Sub-Handlers
//=============================================================================================================================================

/**
 * Create a new document
 * @param {Object} event - Lambda event object
 * @param {Object} event.body - Request body containing document details
 * @param {string} event.body.apartmentId - ID of the apartment
 * @param {Object} event.body.templateFields - Fields to populate in the template
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with created document
 */
const handleCreateDocument = async (event, corsHeaders) => {
  try {
    const documentId = uuidv4();
    const { apartmentId, templateFields } = JSON.parse(event.body);

    const document = await dbData.createDocument({
      document_id: documentId,
      apartment_id: apartmentId,
      template_name: 'rental-agreement',
      template_fields: templateFields,
      saas_tenant_id: SAAS_TENANT_ID,
    });

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: document,
        message: 'Document created successfully',
      }),
    };
  } catch (error) {
    console.error('Error in handleCreateDocument:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Update an existing document
 * @param {string} documentId - UUID of the document to update
 * @param {Object} event - Lambda event object
 * @param {Object} event.body - Request body containing update details
 * @param {Object} event.body.templateFields - Updated template fields
 * @param {string} [event.body.tenantUserId] - User ID of the tenant that resides in the property
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with updated document
 */
const handleUpdateDocument = async (documentId, event, corsHeaders) => {
  try {
    const { templateFields, tenantUserId } = JSON.parse(event.body);

    const document = await dbData.updateDocument({
      document_id: documentId,
      template_fields: templateFields,
      saas_tenant_id: SAAS_TENANT_ID,
      tenant_user_id: tenantUserId,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: document,
        message: 'Document updated successfully',
      }),
    };
  } catch (error) {
    console.error('Error in handleUpdateDocument:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Get a specific document by ID
 * @param {string} documentId - UUID of the document to retrieve
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with document data
 */
const handleGetDocument = async (documentId, corsHeaders) => {
  try {
    const document = await dbData.getDocument({ document_id: documentId, saas_tenant_id: SAAS_TENANT_ID });
    return document
      ? {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            payload: document,
            message: 'Document retrieved successfully',
          }),
        }
      : {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Document not found',
          }),
        };
  } catch (error) {
    console.error('Error in handleGetDocument:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Get all documents for an apartment
 * @param {Object} event - Lambda event object
 * @param {Object} event.queryStringParameters - Query parameters
 * @param {string} event.queryStringParameters.apartmentId - ID of the apartment to fetch documents for
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if apartmentId is missing
 */
const handleGetApartmentDocuments = async (event, corsHeaders) => {
  try {
    const { apartmentId } = event.queryStringParameters || {};
    if (!apartmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'apartmentId is required' }),
      };
    }

    const documents = await dbData.getApartmentDocuments({ apartment_id: apartmentId, saas_tenant_id: SAAS_TENANT_ID });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: documents,
        message: 'Documents retrieved successfully',
      }),
    };
  } catch (error) {
    console.error('Error in handleGetApartmentDocuments:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Get all documents for a tenant
 * @param {Object} event - Lambda event object
 * @param {Object} event.queryStringParameters - Query parameters
 * @param {string} event.queryStringParameters.tenantUserId - ID of the tenant to fetch documents for
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if tenantUserId is missing
 */
const handleGetTenantDocuments = async (event, corsHeaders) => {
  try {
    const { tenantUserId } = event.queryStringParameters || {};
    if (!tenantUserId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'tenantUserId is required' }),
      };
    }

    const documents = await dbData.getTenantDocuments({ tenant_user_id: tenantUserId, saas_tenant_id: SAAS_TENANT_ID });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: documents,
        message: 'Documents retrieved successfully',
      }),
    };
  } catch (error) {
    console.error('Error in handleGetTenantDocuments:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Retrieve the PDF URL of a document
 * @param {string} documentId - ID of the document to retrieve
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with PDF URL
 * @throws {Object} 404 error if PDF not found
 */
const handleGetDocumentPdf = async (documentId, corsHeaders) => {
  try {
    const document = await dbData.getDocument({ document_id: documentId, saas_tenant_id: SAAS_TENANT_ID });
    if (!document) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'PDF not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'PDF URL retrieved successfully',
        pdf_url: await preparePresignedPdfUrl(documentId),
      }),
    };
  } catch (error) {
    console.error('Error retrieving PDF URL:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Delete a document by ID
 * @param {string} documentId - UUID of the document to delete
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with deleted document ID
 * @throws {Object} 404 error if document not found
 */
const handleDeleteDocument = async (documentId, corsHeaders) => {
  try {
    const deletedDocument = await dbData.deleteDocument({ document_id: documentId, saas_tenant_id: SAAS_TENANT_ID });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(deletedDocument),
    };
  } catch (error) {
    console.error('Error in handleDeleteDocument:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Handles file upload and stores it in S3
 * @param {Object} event - Lambda event object
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Promise<Object>} Response object with upload status
 */
const handleFileUpload = async (event, corsHeaders) => {
  try {
    const { documentId, fileName, fileType } = event.queryStringParameters;
    if (!documentId || !fileName || !fileType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'documentId, fileName, and fileType are required for file upload' }),
      };
    }

    const fileContent = extractFileContentFromMultipart(event.body, event.headers['content-type']);
    if (!fileContent) {
      throw new Error('File content could not be extracted');
    }

    const s3Client = new S3Client({ region: APP_AWS_REGION });
    const s3UploadedFileKey = `${prepareS3DocumentFolderKey(documentId, SAAS_TENANT_ID)}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET_NAME,
      Key: s3UploadedFileKey,
      Body: fileContent,
      ContentType: fileType,
    });

    await s3Client.send(command);

    console.log(`File (${fileType}, ${fileContent.length} bytes) uploaded successfully to S3: ${s3UploadedFileKey}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'File uploaded successfully',
        fileKey: s3UploadedFileKey,
      }),
    };
  } catch (error) {
    console.error(
      `Error in handleFileUpload: documentId=${event.queryStringParameters?.documentId}, fileName=${event.queryStringParameters?.fileName}\n${error.message}`
    );
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: `Error uploading file: ${error.message}` }),
    };
  }
};

//=============================================================================================================================================
// Utilities
//=============================================================================================================================================

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: APP_AWS_REGION });

/**
 * Prepare a document URL presigned through CloudFront.
 * @param {string} documentId - The unique identifier for the document.
 * @returns {Promise<string>} The generated presigned URL.
 */
async function preparePresignedPdfUrl(documentId) {
  const command = new GetObjectCommand({
    Bucket: DOCUMENTS_BUCKET_NAME,
    Key: prepareS3Keys(documentId, SAAS_TENANT_ID),
  });

  // Get S3 presigned URL
  const s3PresignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 60 * 60 * 24, // 24 hours
  });

  // Replace S3 domain with CloudFront domain
  const cloudfrontPresignedUrl = s3PresignedUrl.replace(`${DOCUMENTS_BUCKET_NAME}.s3.${APP_AWS_REGION}.amazonaws.com`, DOCUMENTS_CLOUDFRONT_DOMAIN);
  // console.log({ s3PresignedUrl, cloudfrontPresignedUrl });

  return cloudfrontPresignedUrl;
}

/**
 * Extracts file content from a multipart/form-data request body
 * @param {string} base64Body - Base64 encoded multipart form data
 * @param {string} contentType - Content-Type header with boundary
 * @returns {Buffer} The extracted file content
 */
const extractFileContentFromMultipart = (base64Body, contentType) => {
  // Convert base64 to buffer
  const bodyBuffer = Buffer.from(base64Body, 'base64');

  // Get the boundary from content type
  const boundary = contentType.split('boundary=')[1];
  const boundaryBuffer = Buffer.from('--' + boundary);
  const headerEndBuffer = Buffer.from('\r\n\r\n');

  // Find the start of file content (after headers)
  const headerEndPos = bodyBuffer.indexOf(headerEndBuffer);
  if (headerEndPos === -1) {
    throw new Error('Could not find end of headers');
  }
  const startPos = headerEndPos + headerEndBuffer.length;

  // Find the end (next boundary)
  const endPos = bodyBuffer.indexOf(boundaryBuffer, startPos);
  if (endPos === -1) {
    throw new Error('Could not find end boundary');
  }

  // Extract file content (excluding trailing \r\n)
  const fileContent = bodyBuffer.subarray(startPos, endPos - 2);
  return fileContent;
};
