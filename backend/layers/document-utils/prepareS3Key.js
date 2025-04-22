//=============================================================================================================================================
// Utilities
//=============================================================================================================================================

/**
 * Prepares and returns the S3 key for a rental agreement document.
 *
 * @param {string} documentId - The unique identifier for the document.
 * @param {string} saasTenantId - The tenant ID for the SaaS customer.
 * @returns {string} The S3 key in the format: {saasTenantId}/{documentId}-rental-agreement.pdf
 */
function prepareS3Key(documentId, saasTenantId) {
  return `${saasTenantId}/${documentId}/rental-agreement.pdf`;
}

module.exports = {
  prepareS3Key,
};
