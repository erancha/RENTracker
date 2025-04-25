const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');
const { prepareS3RentalAgreementKey, prepareS3DocumentFolderPrefix } = require('/opt/prepareS3Keys');
const AWSXRay = require('aws-xray-sdk');

const SAAS_TENANT_ID = process.env.SAAS_TENANT_ID;
const DOCUMENTS_BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME;
const DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID = process.env.DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID;

const s3Client = new S3Client();
const cloudfront = new CloudFrontClient();

//=============================================================================================================================================
// Main handler
//=============================================================================================================================================
exports.handler = async (event) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  const segment = AWSXRay.getSegment();
  const handlerSubsegment = segment.addNewSubsegment('documentsStreamProcessor');

  for (const record of event.Records) {
    const recordSubsegment = handlerSubsegment.addNewSubsegment(`recordEventName:${record.eventName}`);
    try {
      switch (record.eventName) {
        case 'INSERT':
          await handleCreate(record);
          break;
        case 'MODIFY':
          await handleUpdate(record);
          break;
        case 'REMOVE':
          await handleDelete(record);
          break;
      }
    } catch (error) {
      console.error(`Error processing record: ${JSON.stringify(record)}`, error);
    } finally {
      recordSubsegment.close();
    }
  }

  handlerSubsegment.close();
};

//=============================================================================================================================================
// Sub-handlers
//=============================================================================================================================================

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

/**
 * Triggered by a creation of a document in DDB.
 * Generates a PDF for the document and uploads it to S3.
 * @param {Object} record - DynamoDB stream record.
 * @returns {Promise<void>}
 */
async function handleCreate(record) {
  const newImage = record.dynamodb.NewImage;

  const templateName = newImage.template_name.S;
  const templateFields = convertDynamoMapToObject(newImage.template_fields.M);

  const template = loadTemplate(templateName);
  const interpolated = interpolateTemplate(template, templateFields);
  const processedHtml = preprocessMarkdown(interpolated);
  const html = marked(processedHtml);
  const styledHtml = createStyledHtml(html);
  const pdfBuffer = await convertToPdf(styledHtml);

  const s3Key = prepareS3RentalAgreementKey(newImage.document_id.S, SAAS_TENANT_ID);
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: DOCUMENTS_BUCKET_NAME,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    console.log(`PDF created and uploaded to S3: ${s3Key}`);
  } catch (error) {
    console.error(`Error processing S3 key: ${s3Key}`, error);
  }
}

/**
 * Triggered by a modification of a document in DDB.
 * Regenerates the PDF for the document and uploads it to S3.
 * Invalidates the CloudFront cache for the updated PDF.
 * @param {Object} record - DynamoDB stream record.
 * @returns {Promise<void>}
 */
async function handleUpdate(record) {
  await handleCreate(record);
  await handleInvalidate(record);
}

/**
 * Handle the deletion of a document.
 * Deletes the PDF from S3 and invalidates the CloudFront cache.
 * @param {Object} record - DynamoDB stream record.
 * @returns {Promise<void>}
 */
async function handleDelete(record) {
  const s3DocumentFolderPrefix = prepareS3DocumentFolderPrefix(record.dynamodb.OldImage.document_id.S, SAAS_TENANT_ID);

  try {
    // List all objects with the folder prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: DOCUMENTS_BUCKET_NAME,
      Prefix: s3DocumentFolderPrefix,
    });
    const listResponse = await s3Client.send(listCommand);

    // Delete all objects in the folder
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: DOCUMENTS_BUCKET_NAME,
        Delete: {
          Objects: listResponse.Contents.map((item) => ({ Key: item.Key })),
        },
      });
      await s3Client.send(deleteCommand);
    }
  } catch (error) {
    console.error(`Error deleting folder: ${s3DocumentFolderPrefix}`, error);
  }

  await handleInvalidate(record);
  console.log(`Folder deleted and invalidated from S3: ${s3DocumentFolderPrefix}`);
}

/**
 * Invalidate the CloudFront cache for a document's PDF.
 * @param {Object} record - DynamoDB stream record.
 * @returns {Promise<void>}
 */
async function handleInvalidate(record) {
  const s3Key = prepareS3RentalAgreementKey(record.dynamodb.OldImage.document_id.S, SAAS_TENANT_ID);
  const command = new CreateInvalidationCommand({
    DistributionId: DOCUMENTS_CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `${Date.now()}`,
      Paths: { Quantity: 1, Items: [`/${s3Key}`] },
    },
  });
  await cloudfront.send(command);
  console.log(`CloudFront cache invalidated for: ${s3Key}`);
}

//=============================================================================================================================================
// Utilities
//=============================================================================================================================================

/**
 * Recursively converts a DynamoDB map (M type) into a JavaScript object.
 * @param {Object} dynamoMap - The DynamoDB map to convert.
 * @returns {Object} The converted JavaScript object.
 */
function convertDynamoMapToObject(dynamoMap) {
  const result = {};
  for (const [key, value] of Object.entries(dynamoMap)) {
    if (value.M) {
      result[key] = convertDynamoMapToObject(value.M);
    } else if (value.S !== undefined) {
      result[key] = value.S;
    } else if (value.N !== undefined) {
      result[key] = Number(value.N);
    } else if (value.BOOL !== undefined) {
      result[key] = value.BOOL;
    } else {
      result[key] = value; // Handle other DynamoDB types as needed
    }
  }
  return result;
}

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
      'interpolateTemplate',
      JSON.stringify(
        {
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
