const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// Sample data for testing
const sampleData = {
  city: 'תל אביב',
  date: '2024-04-02',
  landlordName: 'ישראל ישראלי',
  landlordId: '123456789',
  landlordAddress: 'רחוב הרצל 1, תל אביב',
  landlordPhone: '050-1234567',
  tenantName: 'יעקב יעקובי',
  tenantId: '987654321',
  tenantAddress: 'רחוב אלנבי 1, תל אביב',
  tenantPhone: '050-9876543',
  roomCount: 3,
  propertyAddress: 'רחוב דיזנגוף 100, תל אביב',
  leasePeriod: 12,
  startDate: '2024-05-01',
  endDate: '2025-04-30',
  rentAmount: 5000,
  paymentDay: 1,
  initialPayment: 10000,
  initialPaymentMonths: '2',
  standingOrderStart: '2024-07-01',
  standingOrderEnd: '2025-04-30',
  waterLimit: 150,
  electricityLimit: 250,
  includedServices: 'יס  וקו אינטרנט',
  includedEquipment: 'מקרר, תנור, מכונת כביסה, מזגן, ריהוט מלא',
  securityDeposit: 10000,
  guarantorName: 'דוד כהן',
  guarantorId: '456789123',
  guarantorAddress: 'רחוב בן יהודה 50, תל אביב',
  guarantorPhone: '050-5555555',
};

// Load and interpolate template
function loadTemplate(templatePath) {
  return fs.readFileSync(templatePath, 'utf8');
}

function interpolateTemplate(template, data) {
  // First, handle standard {{key}} replacements with highlighting and italics
  let result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? `<mark><i>${value}</i></mark>` : match;
  });

  // Log any remaining uninterpolated placeholders
  const remaining = result.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    console.log('Warning: Uninterpolated placeholders:', remaining);
  }

  // Preserve line breaks by converting them to <br> tags
  result = result.replace(/\n/g, '<br>\n');

  return result;
}

// Pre-process markdown to fix header formatting and bold text
function preprocessMarkdown(markdown) {
  // First, handle bold text with custom HTML
  let processed = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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
}

async function generatePdf(html, outputPath) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--font-render-hinting=none'],
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
      path: outputPath,
      format: 'A4',
      margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      timeout: 60000,
    });

    console.log(`PDF saved to: ${outputPath}`);
    return pdf;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Configure marked options
marked.use({
  headerIds: false,
  mangle: false,
  headerPrefix: '',
  renderer: {
    heading(text, level) {
      // Don't process headings - we're handling them in preprocessMarkdown
      return text;
    },
    html(html) {
      // Pass through our custom HTML
      return html;
    },
  },
});

async function main() {
  try {
    // 1. Load template
    const templatePath = path.join(__dirname, 'templates', 'rental-agreement.md');
    console.log('Loading template from:', templatePath);
    const template = loadTemplate(templatePath);

    // 2. Interpolate template with sample data
    console.log('Interpolating template with sample data...');
    const interpolated = interpolateTemplate(template, sampleData);

    // 3. Pre-process markdown and convert to HTML
    console.log('Converting Markdown to HTML...');
    const processedMarkdown = preprocessMarkdown(interpolated);
    const html = marked(processedMarkdown);

    // 4. Add styling
    const styledHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              text-align: right;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.4;
              font-size: 9pt;
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
              font-size: 10pt;
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
              margin: 0.7em 0;
            }
            
            br {
              display: block;
              margin: 0.5em 0;
              content: "";
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    // 5. Generate PDF
    const outputPath = path.join(__dirname, 'test-output.pdf');
    console.log('Generating PDF...');
    await generatePdf(styledHtml, outputPath);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
