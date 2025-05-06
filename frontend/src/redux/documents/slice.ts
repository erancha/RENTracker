import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IDocument } from './types';
import { createDocumentThunk, updateDocumentThunk, getDocumentThunk, getApartmentDocumentsThunk, getTenantDocumentsThunk } from './thunks';
import initialState from 'redux/store/initialState';
import { toast } from 'react-toastify';

const documentsSlice = createSlice({
  name: 'documents',
  initialState: initialState.documents,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setSelectedDocument(state, action: PayloadAction<IDocument | null>) {
      state.selectedDocument = action.payload;
    },
    addDocument(state, action: PayloadAction<IDocument>) {
      // Remove any existing document with the same ID
      state.documents = state.documents.filter((doc) => doc.document_id !== action.payload.document_id);
      // Add new document at the beginning since we sort by updated_at desc
      state.documents.unshift(action.payload);
    },
    updateDocument(state, action: PayloadAction<IDocument>) {
      // Remove old document
      state.documents = state.documents.filter((doc) => doc.document_id !== action.payload.document_id);
      // Add updated document at the beginning since we sort by updated_at desc
      state.documents.unshift(action.payload);
    },
  },
  extraReducers: (builder) => {
    // Fetch Document
    builder.addCase(getDocumentThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getDocumentThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedDocument = action.payload;
    });
    builder.addCase(getDocumentThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch document';
      state.selectedDocument = null;
    });

    // Fetch Tenant Documents
    builder.addCase(getTenantDocumentsThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getTenantDocumentsThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.documents = action.payload;
    });
    builder.addCase(getTenantDocumentsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch tenant documents';
    });

    // Fetch Apartment Documents
    builder.addCase(getApartmentDocumentsThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.documents = [];
    });
    builder.addCase(getApartmentDocumentsThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.documents = action.payload;
    });
    builder.addCase(getApartmentDocumentsThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch documents';
    });

    // Create Document
    builder.addCase(createDocumentThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(createDocumentThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedDocument = action.payload;
      // Remove any existing document with the same ID
      state.documents = state.documents.filter((doc) => doc.document_id !== action.payload.document_id);
      // Add new document at the beginning since we sort by updated_at desc
      state.documents.unshift(action.payload);
      toast.success('Document created successfully', { autoClose: 2000 });
    });
    builder.addCase(createDocumentThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to create document';
    });

    // Update Document
    builder.addCase(updateDocumentThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updateDocumentThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedDocument = action.payload;
      // Remove any existing document with the same ID
      state.documents = state.documents.filter((doc) => doc.document_id !== action.payload.document_id);
      // Add updated document at the beginning since we sort by updated_at desc
      state.documents.unshift(action.payload);

      const isDocumentSigned = action.payload.template_fields['tenantSignature'];
      toast.success('Document updated successfully', { autoClose: isDocumentSigned ? 2000 : 5000 });
    });
    builder.addCase(updateDocumentThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to update document';
    });
  },
});

export const actions = documentsSlice.actions;

export default documentsSlice.reducer;
