import { IUser } from 'redux/users/types';
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
 * GET /users
 * Returns all users for the tenant
 *
 * Response:
 * {
 *   message: string,
 *   payload: {
 *     users: [{
 *       user_id: string,
 *       user_name: string,
 *       email_address: string,
 *       is_disabled: boolean,
 *       created_at: string
 *     }]
 *   }
 * }
 */
export const getAllUsers = async (JWT: string): Promise<IUser[]> => {
  const url = `${appConfigData.REST_API_URL}/users`;
  return makeJsonRequest(url, 'GET', JWT);
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
