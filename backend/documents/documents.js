const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const dbData = require('/opt/dbData');
const { prepareCorsHeaders } = require('/opt/corsHeaders');

// Configure marked options
marked.use({
  headerIds: false,
  mangle: false,
  headerPrefix: '',
  gfm: true, // Enable GitHub Flavored Markdown
  renderer: {
    heading(text, level) {
      return text; // Don't process headings - we're handling them in preprocessMarkdown
    },
    html(html) {
      return html; // Pass through our custom HTML
    },
  },
});

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.APP_AWS_REGION });

//=============================================================================================================================================
// REST handler: Main entry point for document-related REST API endpoints
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
    const saasTenantId = process.env.SAAS_TENANT_ID;

    // Route to appropriate handler based on method and path
    if (path === '/documents') {
      switch (httpMethod) {
        case 'POST':
          return await handleCreateDocument(event, corsHeaders, saasTenantId);
        case 'GET':
          return event.queryStringParameters?.tenantUserId
            ? await handleGetTenantDocuments(event, corsHeaders, saasTenantId)
            : await handleGetApartmentDocuments(event, corsHeaders, saasTenantId);
      }
    } else if (path.startsWith('/documents/')) {
      const documentId = path.split('/')[2];
      switch (httpMethod) {
        case 'GET':
          if (path.endsWith('/pdf')) {
            return await handleGetDocumentPdf(documentId, corsHeaders, saasTenantId);
          }
          return await handleGetDocument(documentId, corsHeaders, saasTenantId);
        case 'PUT':
          return await handleUpdateDocument(documentId, event, corsHeaders, saasTenantId);
        case 'DELETE':
          return await handleDeleteDocument(documentId, corsHeaders, saasTenantId);
      }
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
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with created document
 */
const handleCreateDocument = async (event, corsHeaders, saasTenantId) => {
  try {
    const documentId = uuidv4();
    const { apartmentId, templateFields } = JSON.parse(event.body);

    const document = await dbData.createDocument({
      document_id: documentId,
      apartment_id: apartmentId,
      template_name: 'rental-agreement',
      template_fields: templateFields,
      saas_tenant_id: saasTenantId,
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
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with updated document
 */
const handleUpdateDocument = async (documentId, event, corsHeaders, saasTenantId) => {
  try {
    const { templateFields, tenantUserId } = JSON.parse(event.body);

    const document = await dbData.updateDocument({
      document_id: documentId,
      template_fields: templateFields,
      saas_tenant_id: saasTenantId,
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
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with document data
 */
const handleGetDocument = async (documentId, corsHeaders, saasTenantId) => {
  try {
    const document = await dbData.getDocument({ document_id: documentId, saas_tenant_id: saasTenantId });
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
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if apartmentId is missing
 */
const handleGetApartmentDocuments = async (event, corsHeaders, saasTenantId) => {
  try {
    const { apartmentId } = event.queryStringParameters || {};
    if (!apartmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'apartmentId is required' }),
      };
    }

    const documents = await dbData.getApartmentDocuments({ apartment_id: apartmentId, saas_tenant_id: saasTenantId });
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
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with list of documents
 * @throws {Object} 400 error if tenantUserId is missing
 */
const handleGetTenantDocuments = async (event, corsHeaders, saasTenantId) => {
  try {
    const { tenantUserId } = event.queryStringParameters || {};
    if (!tenantUserId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'tenantUserId is required' }),
      };
    }

    const documents = await dbData.getTenantDocuments({ tenant_user_id: tenantUserId, saas_tenant_id: saasTenantId });
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
 * Generate and store a PDF version of a document
 * @param {string} documentId - ID of the document to convert
 * @param {Object} corsHeaders - CORS headers to include in response
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with PDF download URL
 * @throws {Object} 404 error if document not found
 * @throws {Object} 500 error if PDF generation fails
 */
const handleGetDocumentPdf = async (documentId, corsHeaders, saasTenantId) => {
  try {
    // Get the document data
    const document = await dbData.getDocument({ document_id: documentId, saas_tenant_id: saasTenantId });
    if (!document) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Document not found' }),
      };
    }

    // Convert markdown template to HTML
    const template = loadTemplate(document.template_name);
    const interpolated = interpolateTemplate(template, document.template_fields);
    const processedHtml = preprocessMarkdown(interpolated);
    const html = marked(processedHtml);

    // Create styled HTML document with proper RTL support
    const styledHtml = createStyledHtml(html);

    // Generate PDF from styled HTML
    const pdfBuffer = await convertToPdf(styledHtml);

    // Store PDF in S3 and return public URL
    const { url } = await storePdfInS3({ pdfBuffer, documentId, saasTenantId });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'PDF generated successfully',
        url,
      }),
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error generating PDF',
        error: error.message,
      }),
    };
  }
};

/**
 * Delete a document by ID
 * @param {string} documentId - UUID of the document to delete
 * @param {Object} corsHeaders - CORS headers to include in response
 * @param {string} saasTenantId - SaaS tenant ID (note: the purpose is only for SaaS multi-tenancy - this has nothing to do with tenants of apartments).
 * @returns {Promise<Object>} Response object with deleted document ID
 * @throws {Object} 404 error if document not found
 */
const handleDeleteDocument = async (documentId, corsHeaders, saasTenantId) => {
  try {
    // Try to delete from S3 first - if this fails, we won't delete from DynamoDB
    try {
      await deletePdfFromS3({ documentId, saasTenantId });
    } catch (error) {
      console.error('Failed to delete PDF from S3:', error);
      // Only throw if the file exists and we failed to delete it
      // If the file doesn't exist (404), that's okay - continue with DB deletion
      if (error.name !== 'NotFound') {
        const err = new Error('Failed to delete PDF from S3. Please try again later.');
        err.statusCode = 409; // Conflict - couldn't complete the delete operation
        throw err;
      }
    }

    // If S3 delete succeeded or file didn't exist, proceed with DB deletion
    const document = await dbData.deleteDocument({ document_id: documentId, saas_tenant_id: saasTenantId });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ documentId }),
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

//=============================================================================================================================================
// Utilities
//=============================================================================================================================================

/**
 * Load a template from the templates directory
 * @param {string} templateName - Name of the template to load
 * @returns {string} Template content in markdown format
 * @throws {Error} If template file not found or cannot be read
 */
const loadTemplate = (templateName) => {
  try {
    // In Lambda, the working directory is /var/task
    const templatePath = process.env.AWS_LAMBDA_FUNCTION_NAME
      ? `/var/task/templates/${templateName}.md`
      : path.join(__dirname, 'templates', `${templateName}.md`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templateName}.md at ${templatePath}`);
    }
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error('Error loading template:', error);
    throw new Error(`Failed to load template: ${error.message}`);
  }
};

/**
 * Format date to DD/MM/YYYY
 * @param {string} dateString - Date string in ISO format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T12:00:00Z');
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format number with thousands separator and optional currency symbol
 * @param {number|string} value - Number to format
 * @param {boolean} [isCurrency=false] - Whether to include currency symbol
 * @returns {string} Formatted number string
 */
function formatNumber(value, isCurrency = false) {
  if (!value && value !== 0) return '';
  const num = Number(value);
  if (isNaN(num)) return value;

  const formatted = num.toLocaleString('he-IL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return isCurrency ? `₪${formatted}` : formatted;
}

/**
 * Interpolate template fields into the template
 * @param {string} template - Template content in markdown format
 * @param {Object} fields - Key-value pairs of fields to interpolate
 * @returns {string} Interpolated template content
 */
const interpolateTemplate = (template, fields) => {
  let result = template;

  // Handle strikethrough for optional sections
  if (!fields.securityRequired) {
    result = result.replace(/^12\.1.*$/m, '~~$&~~');
  }
  if (!fields.guarantorRequired) {
    result = result.replace(/^12\.2.*$/m, '~~$&~~');
    result = result.replace(/^12\.3.*$/m, '~~$&~~');
    result = result.replace(/<!-- guarantorDetails-start -->[\s\S]*?<!-- guarantorDetails-end -->/m, '');
  }
  // if (!fields.securityRequired && !fields.guarantorRequired) {
  //   result = result.replace(/^## 12.*$/m, '~~$&~~\n\n');
  // }

  // Pre-calculate derived values
  if (fields.initialPaymentMonths && fields.rentAmount) {
    fields.initialPayment = Number(fields.initialPaymentMonths) * Number(fields.rentAmount);
  }

  if (fields.startDate && fields.endDate && fields.standingOrderStart && fields.initialPaymentMonths) {
    // Parse all dates (use UTC to avoid timezone issues)
    const startDate = new Date(fields.startDate + 'T12:00:00Z');
    const endDate = new Date(fields.endDate + 'T12:00:00Z');
    const durationsInMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      Number(((endDate.getDate() - startDate.getDate()) / 30).toFixed(1)); // partial month: e.g. 15 days = 0.5 months

    const standingOrderStart = new Date(fields.standingOrderStart + 'T12:00:00Z');
    const standingOrderStartMonthIndex = standingOrderStart.getMonth();
    const standingOrderEndMonthIndex = Math.ceil(standingOrderStartMonthIndex + durationsInMonths - 1 - Number(fields.initialPaymentMonths)); // 01/05 until 31/07 ==> 3 durationsInMonths ==> payments on 1/5, 1/6 and 1/7 === standingOrderEndMonthIndex 6 (4 + 3 - 1)
    const standingOrderEnd = new Date(
      standingOrderStart.getFullYear(), // actual year number (e.g., 2025)
      standingOrderEndMonthIndex, // monthIndex: 0-based (0-11, where 0 = January, 11 = December)
      1 // day: 1-based (1-31), setting to 1st of the month
    );

    fields.standingOrderEnd = formatDate(standingOrderEnd.toISOString().split('T')[0]);

    console.log(
      JSON.stringify(
        {
          function: 'interpolateTemplate',
          'fields.startDate': fields.startDate,
          startDate,
          'fields.endDate': fields.endDate,
          endDate,
          'fields.initialPaymentMonths': fields.initialPaymentMonths,
          durationsInMonths,
          'fields.standingOrderStart': fields.standingOrderStart,
          standingOrderStart,
          standingOrderStartMonthIndex,
          standingOrderEndMonthIndex,
          standingOrderEnd,
          'fields.standingOrderEnd': fields.standingOrderEnd,
        },
        null,
        2
      )
    );
  }

  // Format dates before interpolation
  if (fields.date) fields.date = formatDate(fields.date);
  if (fields.startDate) fields.startDate = formatDate(fields.startDate);
  if (fields.endDate) fields.endDate = formatDate(fields.endDate);
  if (fields.standingOrderStart) fields.standingOrderStart = formatDate(fields.standingOrderStart);

  // Format monetary values
  if (fields.rentAmount) fields.rentAmount = formatNumber(fields.rentAmount, true);
  if (fields.initialPayment) fields.initialPayment = formatNumber(fields.initialPayment, true);
  if (fields.securityDeposit) fields.securityDeposit = formatNumber(fields.securityDeposit, true);
  if (fields.waterLimit) fields.waterLimit = formatNumber(fields.waterLimit, true);
  if (fields.electricityLimit) fields.electricityLimit = formatNumber(fields.electricityLimit, true);

  // Handle standard {{key}} replacements with highlighting and italics
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, field) => {
    const value = fields[field.trim()];
    return value !== undefined && value !== '' ? `<mark><i>${value}</i></mark>` : `____________`;
  });

  // Log any remaining uninterpolated placeholders
  const remaining = result.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    console.log('Warning: Uninterpolated placeholders:', remaining);
  }

  // Preserve line breaks by converting them to <br> tags
  result = result.replace(/\n/g, '<br>\n');
  return result;
};

/**
 * Preprocess markdown content before conversion
 * @param {string} markdown - Raw markdown content
 * @returns {string} Processed markdown with proper RTL and formatting
 */
const preprocessMarkdown = (markdown) => {
  // First, handle bold text with custom HTML
  let processed = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Handle strikethrough text
  processed = processed.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Handle section headers (both numbered and non-numbered, h2 and h3)
  processed = processed.replace(/^(#{2,3})\s*(?:(\d+)\.\s*)?(.+)$/gm, (match, hashes, number, title) => {
    const level = hashes.length;
    const className = `section-header-${level}`;
    return number
      ? `<h${level} class="${className}"><span class="section-number"><strong>${number}.</strong></span> ${title}</h${level}>`
      : `<h${level} class="${className}">${title}</h${level}>`;
  });

  // Handle subsection numbers (e.g., 8.1, 8.2)
  processed = processed.replace(/^(\d+\.\d+)\s/gm, '<strong>$1</strong> ');

  // Handle Hebrew letters with dot (e.g., א., ב., ג.)
  processed = processed.replace(/^([א-ת])\.\s/gm, '<strong>$1.</strong> ');

  // Replace other headers
  processed = processed.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Convert newlines to <br> after header processing
  processed = processed.replace(/\n/g, '<br>\n');

  return processed;
};

/**
 * Create a styled HTML document with proper RTL support
 * @param {string} content - HTML content to style
 * @returns {string} Complete HTML document with styling
 */
const createStyledHtml = (content) => {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            margin: 1.5cm;
            size: A4;
          }
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            text-align: right;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.4;
            font-size: 8pt;
          }
          
          mark {
            background-color: #fff3b8;
            padding: 0 2px;
          }
          
          mark i {
            font-style: italic;
            font-weight: 500;
          }
          
          .bold-text {
            font-weight: bold;
            text-align: center;
            margin: 1em 0;
            font-size: 10pt;
            display: block;
          }
          
          h1 {
            color: #000;
            font-size: 18pt;
            font-weight: bold;
            margin: 0.5em 0 1em 0;
            page-break-after: avoid;
            text-align: center;
          }
          
          h2.section-header-2 {
            color: #000;
            font-size: 13pt;
            font-weight: bold;
            margin: 1.2em 0 0.6em 0;
            page-break-after: avoid;
          }
          
          h3.section-header-3 {
            color: #000;
            font-size: 8pt;
            font-weight: bold;
            margin: 2.5em 0 0.4em 0;
            page-break-after: avoid;
          }
          
          .section-number {
            display: inline-block;
            margin-left: 0.5em;
          }
          
          strong {
            font-weight: bold;
          }
          
          .section-number strong {
            font-weight: bold;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: right;
          }
          
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          
          p {
            margin: 0.8em 0;
          }
          
          br {
            display: block;
            margin: 0.7em 0;
            content: "";
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
};

/**
 * Convert HTML string to PDF buffer using Puppeteer
 * @param {string} html - The HTML content to convert
 * @returns {Promise<Buffer>} PDF file as a buffer
 */
async function convertToPdf(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set viewport for better rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2,
    });

    // Emulate high-DPI device for better text rendering
    await page.emulateMediaFeatures([{ name: 'color-gamut', value: 'p3' }]);

    // Set content with proper wait conditions and longer timeout
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 60000,
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Generate PDF with enhanced settings
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      timeout: 60000,
    });

    return pdf;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Get the S3 key for a document's PDF
 * @param {string} saasTenantId - Tenant ID for path isolation
 * @param {string} documentId - Document ID for filename
 * @returns {string} S3 key for the PDF file
 */
function getPdfS3Key({ documentId, saasTenantId }) {
  return `documents/${saasTenantId}/${documentId}-rental-agreement.pdf`;
}

/**
 * Store PDF buffer in S3 and return its public URL
 * @param {Buffer} pdfBuffer - The PDF file contents
 * @param {string} saasTenantId - Tenant ID for path isolation
 * @param {string} documentId - Document ID for filename
 * @returns {Promise<{url: string}>} Object containing the public URL
 */
async function storePdfInS3({ pdfBuffer, documentId, saasTenantId }) {
  try {
    const bucketName = process.env.FRONTEND_BUCKET_NAME;
    const key = getPdfS3Key({ documentId, saasTenantId });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    return {
      url: `https://${bucketName}.s3.${process.env.APP_AWS_REGION}.amazonaws.com/${key}`,
    };
  } catch (error) {
    console.error('Error storing PDF in S3:', error);
    throw error;
  }
}

/**
 * Delete PDF from S3
 * @param {string} saasTenantId - Tenant ID for path isolation
 * @param {string} documentId - Document ID for filename
 * @returns {Promise<void>}
 */
async function deletePdfFromS3({ documentId, saasTenantId }) {
  try {
    const bucketName = process.env.FRONTEND_BUCKET_NAME;
    const key = getPdfS3Key({ documentId, saasTenantId });

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Error deleting PDF from S3:', error);
    throw error;
  }
}
