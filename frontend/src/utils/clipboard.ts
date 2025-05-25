/**
 * Gets a document ID from the clipboard, handling permissions appropriately
 * @returns {Promise<string | null>} The document ID if found, null otherwise
 */
export const getDocumentIdFromClipboard = async (): Promise<{ text: string | null; documentId: string | null }> => {
  let text = null;
  try {
    // Check if we have permission first
    const hasPermission = await hasClipboardPermission();
    if (!hasPermission) {
      console.warn('Clipboard permission not granted');
      return { text: null, documentId: null };
    }

    text = await navigator.clipboard.readText();
    const documentId = parseDocumentIdFromText(text);
    return {
      text,
      documentId: documentId ? documentId.trim() : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      console.warn('Clipboard access requires user interaction');
    } else {
      console.error('Error reading clipboard:', error);
    }
    return { text, documentId: null };
  }
};

/**
 * Extracts a document ID from text. Supports two formats:
 * 1. Simple document-id format: "document-id: xxx"
 * 2. Rental agreement URL format: containing two UUIDs where the second one is followed by '/rental-agreement.pdf'
 *
 * @param {string} text - The text to extract document ID from
 * @returns {string|null} The extracted document ID or null if not found
 */
export const parseDocumentIdFromText = (text: string): string | null => {
  if (!text) return null;

  // Check if text is exactly a UUID
  if (text.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return text;
  }

  // Try simple document-id format
  const simpleMatch = text.match(/document-id[:=]?\s*([a-zA-Z0-9-]+)/i);
  if (simpleMatch) return simpleMatch[1];

  // Try rental agreement URL format
  const urlMatch = text.match(
    /https.*?\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b.*?\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b(?=\/rental-agreement\.pdf)/i
  );

  const documentId = urlMatch ? urlMatch[2] : null;
  return documentId;
};

/**
 * Checks if we have clipboard read permission
 * @returns {Promise<boolean>} Whether we have permission
 */
const hasClipboardPermission = async (): Promise<boolean> => {
  try {
    const result = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
    return result.state === 'granted';
  } catch {
    // If the browser doesn't support permission checking, we'll try reading directly
    return true;
  }
};
