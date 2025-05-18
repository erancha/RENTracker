import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IDocument } from './types';
import { createDocumentThunk, updateDocumentThunk, getDocumentThunk, getApartmentDocumentsThunk, getTenantDocumentsThunk } from './thunks';
import initialState from 'redux/store/initialState';
import { toast } from 'react-toastify';
import i18next from 'i18next';

// a wrapper function
const translate = (key: string): string => {
  try {
    // @ts-ignore - Tell TypeScript to ignore this line
    return i18next.t(key);
  } catch (e) {
    // Fallback if translation fails
    return key;
  }
};

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
      state.error = /*action.error.message ||*/ 'Failed to fetch document';
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

      // Use our wrapper function to handle translation
      toast.success(translate('messages.documentCreated') + '. ' + translate('documentForm.messages.shareWithTenant'), { autoClose: 5000 });
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

      // Translate:
      const updateMessage =
        translate('messages.documentUpdated') +
        '. ' +
        (action.payload.template_fields.landlordSignature
          ? translate('documentForm.messages.agreementSignedByBoth') // signed by both the landlord (and the tenant)
          : !action.payload.template_fields.tenant1Id // not yet filled by the tenant
          ? ''
          : action.payload.template_fields.tenantSignature // signed by the tenant
          ? translate('documentForm.messages.shareWithLandlord')
          : translate('tenantDocuments.pleaseSignAndShare'));
      toast.success(updateMessage, { autoClose: 5000 });
    });
    builder.addCase(updateDocumentThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to update document';
    });
  },
});

export const actions = documentsSlice.actions;

export default documentsSlice.reducer;
