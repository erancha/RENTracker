import { createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store/reducers';
import * as rest from '../../services/rest';
import { IDocument } from './types';
import { actions } from './slice';

/**
 * Creates a new document
 * @param data - Document creation payload containing apartmentId and templateFields
 */
interface CreateDocumentPayload {
  apartmentId: string;
  templateFields: Record<string, string>;
}

export const createDocumentThunk = createAsyncThunk<IDocument, CreateDocumentPayload>('documents/createDocumentThunk', async (data, { dispatch, getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  const document = await rest.createDocument(JWT, data);
  dispatch(actions.addDocument(document));
  return document;
});

/**
 * Updates an existing document
 * @param data - Document update payload containing documentId and templateFields
 */
interface UpdateDocumentPayload {
  documentId: string;
  templateFields: Record<string, string>;
}

export const updateDocumentThunk = createAsyncThunk<IDocument, UpdateDocumentPayload>('documents/updateDocument', async (data, { dispatch, getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  const document = await rest.updateDocument(JWT, data);
  dispatch(actions.updateDocument(document));
  return document;
});

/**
 * Fetches a single document by ID
 * @param documentId - ID of the document to fetch
 */
export const getDocumentThunk = createAsyncThunk<IDocument, string>('documents/getDocumentThunk', async (documentId, { dispatch, getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  const document = await rest.getDocument(JWT, documentId);
  dispatch(actions.setSelectedDocument(document));
  return document;
});

/**
 * Fetches all documents for an apartment
 * @param apartmentId - ID of the apartment to fetch documents for
 */
export const getApartmentDocumentsThunk = createAsyncThunk<IDocument[], string>('documents/getApartmentDocumentsThunk', async (apartmentId, { getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  return await rest.getApartmentDocuments(JWT, apartmentId);
});

/**
 * Fetches all documents for a tenant
 * @param tenantUserId - ID of the tenant to fetch documents for
 */
export const getTenantDocumentsThunk = createAsyncThunk<IDocument[], string>('documents/getTenantDocumentsThunk', async (tenantUserId, { getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  return await rest.getTenantDocuments(JWT, tenantUserId);
});

/**
 * Deletes a document by ID
 * @param documentId - ID of the document to delete
 */
export const deleteDocumentThunk = createAsyncThunk<string, string>('documents/deleteDocument', async (documentId, { dispatch, getState }) => {
  const state = getState() as RootState;
  const JWT = state.auth.JWT;
  if (!JWT) throw new Error('No JWT token');

  return await rest.deleteDocument(JWT, documentId);
});
