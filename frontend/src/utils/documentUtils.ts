import appConfigData from '../appConfig.json';

/**
 * Generate a PDF for a documentId into S3 and return its URL.
 * @param {string} documentId - ID of document to download
 * @param {string | null} JWT - JSON Web Token for authentication
 */
export const handlePdfGeneration = async (documentId: string, JWT: string | null): Promise<string | null> => {
  if (!JWT) {
    console.error('No JWT token available');
    return null;
  }

  try {
    const response = await fetch(`${appConfigData.REST_API_URL}/documents/${documentId}/pdf`, {
      headers: {
        Authorization: `Bearer ${JWT}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get PDF URL');
    const { url: pdfUrl } = await response.json();
    if (!pdfUrl) throw new Error('No PDF URL in response');

    // The PDF will be opened in new tab (S3 object has Content-Disposition: inline)
    return pdfUrl;
  } catch (error) {
    console.error('Error opening PDF:', error);
    return null;
  }
};

/**
 * Generates a title for a rental agreement document
 * @param tenantName - Optional name of the tenant to include in the title
 * @returns A string in the format "הסכם שכירות - {tenantName}" or just "הסכם שכירות" if no tenant name provided
 */
export const getDocumentTitle = (tenantName?: string) => `הסכם שכירות${tenantName ? ` - ${tenantName}` : ''}`;
