import { IDocument } from '../redux/documents/types';
import appConfigData from '../appConfig.json';

interface IApiResponse<T> {
  payload: T;
  message?: string;
}

/**
 * Makes an authenticated request to the API for JSON data
 */
const makeJsonRequest = async <T>(url: string, method: string, JWT: string, body?: any): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: IApiResponse<T> = await response.json();
  return data.payload;
};

/**
 * POST /documents
 * Creates a new document
 */
export const createDocument = async (JWT: string, data: { apartmentId: string; templateFields: Record<string, string> }): Promise<IDocument> => {
  const url = `${appConfigData.REST_API_URL}/documents`;
  return makeJsonRequest(url, 'POST', JWT, {
    ...data,
    templateName: 'rental-agreement',
  });
};

/**
 * PUT /documents/:documentId
 * Updates an existing document
 */
export const updateDocument = async (
  JWT: string,
  data: { documentId: string; templateFields: Record<string, string>; tenantUserId?: string }
): Promise<IDocument> => {
  const url = `${appConfigData.REST_API_URL}/documents/${data.documentId}`;
  return makeJsonRequest(url, 'PUT', JWT, {
    templateFields: data.templateFields,
    tenantUserId: data.tenantUserId,
  });
};

/**
 * GET /documents/:documentId
 * Returns a specific document
 */
export const getDocument = async (JWT: string, documentId: string): Promise<IDocument> => {
  const url = `${appConfigData.REST_API_URL}/documents/${documentId}`;
  return makeJsonRequest(url, 'GET', JWT);
};

/**
 * GET /documents
 * Returns all documents for an apartment
 *
 * Response:
 * {
 *   message: string,
 *   payload: [{
 *     document_id: string,
 *     apartment_id: string,
 *     template_name: string,
 *     template_fields: Record<string, string>,
 *     status: string,
 *     created_at: string,
 *   }]
 * }
 */
export const getApartmentDocuments = async (JWT: string, apartmentId: string): Promise<IDocument[]> => {
  const url = `${appConfigData.REST_API_URL}/documents?apartmentId=${apartmentId}`;
  // for (let i = 0; i < 10; i++) await makeJsonRequest(url, 'GET', JWT);
  return makeJsonRequest(url, 'GET', JWT);
};

/**
 * GET /documents
 * Returns all documents for a tenant
 *
 * Response:
 * {
 *   message: string,
 *   payload: [{
 *     document_id: string,
 *     apartment_id: string,
 *     template_name: string,
 *     template_fields: Record<string, string>,
 *     status: string,
 *     created_at: string,
 *   }]
 * }
 */
export const getTenantDocuments = async (JWT: string, tenantUserId: string): Promise<IDocument[]> => {
  const url = `${appConfigData.REST_API_URL}/documents?tenantUserId=${tenantUserId}`;
  return makeJsonRequest(url, 'GET', JWT);
};

/**
 * DELETE /documents/:documentId
 * Deletes a document by ID
 * @param JWT - JWT token for authentication
 * @param documentId - ID of the document to delete
 * @returns Promise<string> - ID of the deleted document
 */
export const deleteDocument = async (JWT: string, documentId: string): Promise<string> => {
  const url = `${appConfigData.REST_API_URL}/documents/${documentId}`;
  return makeJsonRequest(url, 'DELETE', JWT);
};

/**
 * POST /upload
 * Uploads a file to the server
 */
export const uploadFile = async ({
  JWT,
  file,
  documentId,
  fileName,
}: {
  JWT: string;
  file: File;
  documentId: string;
  fileName?: string;
}): Promise<{ message: string; fileKey: string }> => {
  if (!documentId || documentId === 'undefined' || !fileName || fileName === 'undefined') {
    console.warn('Warning: documentId or fileName is falsy or undefined');
  }

  const url = `${appConfigData.REST_API_URL}/upload?documentId=${documentId}&fileName=${fileName || file.name}&fileType=${
    file.type || 'application/octet-stream'
  }`;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * POST /upload
 * Uploads base64 image data to the server
 */
export const uploadContent = async ({
  JWT,
  content,
  fileName,
  documentId,
}: {
  JWT: string;
  content: string;
  fileName: string;
  documentId?: string;
}): Promise<{ message: string; fileKey: string }> => {
  const fileType = 'image/png';

  // Convert base64 to blob
  const base64Data = content.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  const blob = new Blob(byteArrays, { type: fileType });

  const formData = new FormData();
  formData.append('file', blob);

  const url = `${appConfigData.REST_API_URL}/upload?documentId=${documentId}&fileName=${fileName}&fileType=${fileType}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload content');
  }

  return response.json();
};
