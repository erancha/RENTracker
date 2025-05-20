const { v4: uuidv4 } = require('uuid');
const { prepareCorsHeaders } = require('/opt/corsHeaders');
const dbData = require('/opt/dbData');
const { prepareS3DocumentFolderPrefix, prepareS3RentalAgreementKey } = require('/opt/prepareS3Keys');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const AWSXRay = require('aws-xray-sdk');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { insertMessageToSQS } = require('/opt/redisClient');

const AWS_REGION = process.env.APP_AWS_REGION;
const DOCUMENTS_CLOUDFRONT_DOMAIN = process.env.DOCUMENTS_CLOUDFRONT_DOMAIN;
const DOCUMENTS_BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;
const SQS_MESSAGES_TO_CLIENTS_Q_URL = process.env.SQS_MESSAGES_TO_CLIENTS_Q_URL;

//=============================================================================================================================================
// Main REST handler
//=============================================================================================================================================
exports.handler = async (event) => {
  // console.log(JSON.stringify(event, null, 2));
  const segment = AWSXRay.getSegment();
  const { httpMethod, path, origin } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);

  // Handle OPTIONS requests for CORS preflight
  if (httpMethod === 'OPTIONS') {
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

    // Route to appropriate handler based on method and path
    if (path === '/documents') {
      switch (httpMethod) {
        case 'POST':
          return await handleCreateDocument({ event, parentSegment: segment });
        case 'GET':
          return event.queryStringParameters?.tenantUserId
            ? await handleGetTenantDocuments({ event, parentSegment: segment })
            : await handleGetApartmentDocuments({ event, parentSegment: segment });
      }
    } else if (path.startsWith('/documents/')) {
      const documentId = path.split('/')[2];
      switch (httpMethod) {
        case 'GET':
          if (path.endsWith('/pdf')) {
            return await handleGetDocumentPdf({ documentId, event, parentSegment: segment });
          }
          return await handleGetDocument({ documentId, event, parentSegment: segment });
        case 'PUT':
          return await handleUpdateDocument({ documentId, event, parentSegment: segment });
        case 'DELETE':
          return await handleDeleteDocument({ documentId, event, parentSegment: segment });
      }
    } else if (path === '/upload' && httpMethod === 'POST') {
      return await handleFileUpload({ event, parentSegment: segment });
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
 * @param {Object} params - Parameters object
 * @param {Object} params.event - Lambda event object
 * @param {Object} params.event.body - Request body containing document details
 * @param {string} params.event.body.apartmentId - ID of the apartment
 * @param {Object} params.event.body.templateFields - Fields to populate in the template
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with created document
 */
const handleCreateDocument = async ({ event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleCreateDocument');
  try {
    const documentId = uuidv4();
    const { apartmentId, templateFields } = extractDocumentCreationValues(event.body);

    const document = await dbData.createDocument({
      document_id: documentId,
      apartment_id: apartmentId,
      template_name: 'rental-agreement',
      template_fields: templateFields,
      saas_tenant_id: senderUserId,
    });

    await sendRentalAgreementEmail(document.template_fields);

    subsegment.close();
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: document,
        message: 'Document created successfully',
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {string} params.documentId - UUID of the document to update
 * @param {Object} params.event - Lambda event object
 * @param {Object} params.event.body - Request body containing update details
 * @param {Object} params.event.body.templateFields - Updated template fields
 * @param {string} [params.event.body.tenantUserId] - User ID of the tenant that resides in the property
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with updated document
 */
const handleUpdateDocument = async ({ documentId, event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleUpdateDocument');
  try {
    const { templateFields, tenantUserId } = extractDocumentUpdateValues(event.body);

    const document = await dbData.updateDocument({
      document_id: documentId,
      template_fields: templateFields,
      senderUserId,
      tenantUserId,
    });
    // console.log(JSON.stringify(document, null, 2));

    await sendRentalAgreementEmail(document.template_fields);
    await sendCloudfrontInvalidationCommand(documentId, document.saas_tenant_id);

    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: document,
        message: 'Document updated successfully',
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {string} params.documentId - UUID of the document to retrieve
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with document data
 */
const handleGetDocument = async ({ documentId, event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleGetDocument');
  try {
    const document = await dbData.getDocument({ document_id: documentId, senderUserId });
    subsegment.close();
    return document
      ? {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            payload: { ...document, presignedUrls: await prepareAttachmentsPresignedUrls(documentId, document.template_fields, document.saas_tenant_id) },
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
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {Object} params.event - Lambda event object
 * @param {Object} params.event.queryStringParameters - Query parameters
 * @param {string} params.event.queryStringParameters.apartmentId - ID of the apartment to fetch documents for
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if apartmentId is missing
 */
const handleGetApartmentDocuments = async ({ event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleGetApartmentDocuments');
  try {
    const { apartmentId } = extractDocumentQueryParams(extractEventValues(event).queryParams);
    if (!apartmentId) {
      subsegment.close();
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'apartmentId is required' }),
      };
    }

    const documents = await dbData.cache.getApartmentDocuments({ apartment_id: apartmentId, saas_tenant_id: senderUserId });
    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: documents,
        message: 'Documents retrieved successfully',
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
    console.error('Error in handleGetApartmentDocuments:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

/**
 * Get all documents for an apartment tenant (i.e. not SaaS tenant, which is the landlord)
 * @param {Object} params - Parameters object
 * @param {Object} params.event - Lambda event object
 * @param {Object} params.event.queryStringParameters - Query parameters
 * @param {string} params.event.queryStringParameters.tenantUserId - ID of the tenant to fetch documents for
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if tenantUserId is missing
 */
const handleGetTenantDocuments = async ({ event, parentSegment }) => {
  const { origin } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleGetTenantDocuments');
  try {
    const { tenantUserId } = extractDocumentQueryParams(extractEventValues(event).queryParams);
    if (!tenantUserId) {
      subsegment.close();
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'tenantUserId is required' }),
      };
    }

    const documents = await dbData.getTenantDocuments({ tenant_user_id: tenantUserId });
    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        payload: documents,
        message: 'Documents retrieved successfully',
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {string} params.documentId - ID of the document to retrieve
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with PDF URL
 * @throws {Object} 404 error if PDF not found
 */
const handleGetDocumentPdf = async ({ documentId, event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleGetDocumentPdf');
  try {
    const document = await dbData.getDocument({ document_id: documentId, senderUserId });
    if (!document) {
      subsegment.close();
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Document not found' }),
      };
    }

    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'PDF URL retrieved successfully',
        pdf_url: await preparePresignedUrl({ documentId, saasTenantId: document.saas_tenant_id }),
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {string} params.documentId - UUID of the document to delete
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with deleted document ID
 * @throws {Object} 404 error if document not found
 */
const handleDeleteDocument = async ({ documentId, event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleDeleteDocument');
  try {
    const deletedDocumentId = await dbData.deleteDocument({ document_id: documentId, saas_tenant_id: senderUserId });
    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(deletedDocumentId),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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
 * @param {Object} params - Parameters object
 * @param {Object} params.event - Lambda event object
 * @param {Object} params.corsHeaders - CORS headers to include in response
 * @param {Object} params.parentSegment - AWS X-Ray parent segment
 * @returns {Promise<Object>} Response object with upload status
 */
const handleFileUpload = async ({ event, parentSegment }) => {
  const { origin, senderUserId } = extractEventValues(event);
  const corsHeaders = prepareCorsHeaders(origin);
  const subsegment = parentSegment.addNewSubsegment('handleFileUpload');
  try {
    const { documentId, fileName, fileType } = extractDocumentQueryParams(extractEventValues(event).queryParams);
    if (isInvalidValue(documentId) || isInvalidValue(fileName) || isInvalidValue(fileType)) {
      throw { statusCode: 400, message: 'documentId, fileName, and fileType are required for file upload' };
    }

    const fileContent = extractFileContentFromMultipart(event.body, event.headers['content-type']);
    if (!fileContent) throw new Error('File content could not be extracted');

    const document = await dbData.getDocument({ document_id: documentId, senderUserId });
    if (!document) {
      subsegment.close();
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Document not found' }),
      };
    }

    const s3Client = new S3Client({ region: AWS_REGION });
    const s3UploadedFileKey = `${prepareS3DocumentFolderPrefix(documentId, document.saas_tenant_id)}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET_NAME,
      Key: s3UploadedFileKey,
      Body: fileContent,
      ContentType: fileType,
    });

    await s3Client.send(command);

    console.log(`File (${fileType}, ${fileContent.length} bytes) uploaded successfully to S3: ${s3UploadedFileKey}`);

    subsegment.close();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'File uploaded successfully',
        fileKey: s3UploadedFileKey,
      }),
    };
  } catch (error) {
    subsegment.addError(error);
    subsegment.close();
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

/**
 * Send email notification about rental agreement updates
 * @param {Object} templateFields - The template fields from the document
 * @returns {Promise<void>}
 */
async function sendRentalAgreementEmail(templateFields) {
  const sqsClient = captureAWSv3Client(new SQSClient({ region: AWS_REGION }));
  await insertMessageToSQS(
    JSON.stringify({
      emailParams: {
        toAddresses: [templateFields.landlordEmail, ...(templateFields.tenant1Email ? [templateFields.tenant1Email] : [])],
        subject: `Rental Agreement: ${templateFields.propertyAddress} - ${templateFields.landlordName || ''} : ${templateFields.tenant1Name || ''}`,
        message: `
          <h2>Rental Agreement Details</h2>
          <p>Property: ${templateFields.propertyAddress}</p>
          <p>Lease Period: ${templateFields.leasePeriod} months</p>
          <p>Start Date: ${templateFields.startDate}</p>
          <p>End Date: ${templateFields.endDate}</p>
          <p>Monthly Rent: ₪${templateFields.rentAmount}</p>
          <br/>
          <h3>Tenant Details:</h3>
          <p>Name: ${templateFields.tenant1Name}</p>
          <p>Phone: ${templateFields.tenant1Phone}</p>
          <p>Email: ${templateFields.tenant1Email}</p>
          ${(!!templateFields.tenantSignature && '<p>Signed</p>') || ''}
          <br/>
          <h3>Landlord Details:</h3>
          <p>Name: ${templateFields.landlordName}</p>
          <p>Phone: ${templateFields.landlordPhone}</p>
          <p>Email: ${templateFields.landlordEmail}</p>
          ${(!!templateFields.landlordSignature && '<p>Signed</p>') || (!!templateFields.tenantSignature && '<p>Pending signing ...</p>') || ''}
          <br/>
          <p>The rental agreement has been updated in the system.</p>
        `,
      },
    }),
    sqsClient,
    SQS_MESSAGES_TO_CLIENTS_Q_URL
  );
}

/**
 * Send email notification about rental agreement updates
 * @param {Object} templateFields - The template fields from the document
 * @returns {Promise<void>}
 */
async function sendCloudfrontInvalidationCommand(documentId, saasTenantId) {
  const sqsClient = captureAWSv3Client(new SQSClient({ region: AWS_REGION }));
  await insertMessageToSQS(
    JSON.stringify({ cloudfrontInvalidationParams: { s3Key: prepareS3RentalAgreementKey(documentId, saasTenantId) } }),
    sqsClient,
    SQS_MESSAGES_TO_CLIENTS_Q_URL
  );
}

/**
 * Extract common values from the event object
 * @param {Object} event - Lambda event object
 * @returns {Object} Object containing extracted values
 */
function extractEventValues(event) {
  return {
    httpMethod: event.httpMethod,
    path: event.path,
    senderUserId: event.requestContext.authorizer?.claims.sub,
    origin: event.headers?.origin,
    queryParams: event.queryStringParameters || {},
  };
}

/**
 * Extract document-related values from query parameters
 * @param {Object} queryParams - Query parameters from the event
 * @returns {Object} Object containing document-related values
 */
function extractDocumentQueryParams(queryParams) {
  const { documentId, fileName, fileType, apartmentId, tenantUserId } = queryParams;
  return { documentId, fileName, fileType, apartmentId, tenantUserId };
}

/**
 * Extract document creation values from request body
 * @param {string} body - Request body string
 * @returns {Object} Object containing document creation values
 */
function extractDocumentCreationValues(body) {
  const { apartmentId, templateFields } = JSON.parse(body);
  return { apartmentId, templateFields };
}

/**
 * Extract document update values from request body
 * @param {string} body - Request body string
 * @returns {Object} Object containing document update values
 */
function extractDocumentUpdateValues(body) {
  const { templateFields, tenantUserId } = JSON.parse(body);
  return { templateFields, tenantUserId };
}

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: AWS_REGION });

/**
 * Prepare a document URL presigned through CloudFront.
 * @param {string} documentId - The unique identifier for the document.
 * @param {string} fileName - The name of the file to be presigned. If not provided, defaults to 'rental-agreement.pdf'.
 * @param {string} saasTenantId - The user id of the SaaS tenant (AKA the landlord).
 * @returns {Promise<string>} The generated presigned URL.
 */
async function preparePresignedUrl({ documentId, fileName, saasTenantId }) {
  const command = new GetObjectCommand({
    Bucket: DOCUMENTS_BUCKET_NAME,
    Key: fileName ? `${prepareS3DocumentFolderPrefix(documentId, saasTenantId)}/${fileName}` : prepareS3RentalAgreementKey(documentId, saasTenantId),
  });

  // Get S3 presigned URL
  const s3PresignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 60 * 60 * 24, // 24 hours
  });

  // Replace S3 domain with CloudFront domain
  const cloudfrontPresignedUrl = s3PresignedUrl.replace(`${DOCUMENTS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`, DOCUMENTS_CLOUDFRONT_DOMAIN);
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

/**
 * Prepare presigned URLs for specific fields in the document's template fields.
 * @param {string} documentId - The unique identifier for the document.
 * @param {Object} templateFields - The template fields containing file names for idCard, salary1, and salary2.
 * @param {string} saasTenantId - The user id of the SaaS tenant (AKA the landlord).
 * @returns {Promise<Object>} An object containing presigned URLs for idCard, salary1, and salary2.
 */
async function prepareAttachmentsPresignedUrls(documentId, templateFields, saasTenantId) {
  const prepareTenantAttachmentsUrls = async (documentId, templateFields, tenantPrefix) => {
    const urls = {};
    if (templateFields[`${tenantPrefix}IdCard`])
      urls[`${tenantPrefix}IdCard`] = await preparePresignedUrl({ documentId, fileName: `${tenantPrefix}IdCard`, saasTenantId });
    if (templateFields[`${tenantPrefix}Salary1`])
      urls[`${tenantPrefix}Salary1`] = await preparePresignedUrl({ documentId, fileName: `${tenantPrefix}Salary1`, saasTenantId });
    if (templateFields[`${tenantPrefix}Salary2`])
      urls[`${tenantPrefix}Salary2`] = await preparePresignedUrl({ documentId, fileName: `${tenantPrefix}Salary2`, saasTenantId });
    return urls;
  };

  const presignedUrls = {
    ...(await prepareTenantAttachmentsUrls(documentId, templateFields, 'tenant1')),
    ...(await prepareTenantAttachmentsUrls(documentId, templateFields, 'tenant2')),
  };

  return presignedUrls;
}

/**
 * Utility function to check for invalid values
 * @param {any} value - The value to check
 * @returns {boolean} True if the value is invalid, false otherwise
 */
function isInvalidValue(value) {
  return !value || value === 'undefined';
}
