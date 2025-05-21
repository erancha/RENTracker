import React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { RootState } from '../redux/store/reducers';
import { IDocument } from '../redux/documents/types';
import { getDocumentThunk, getApartmentDocumentsThunk, deleteDocumentThunk } from '../redux/documents/thunks';
import { actions as documentActions } from '../redux/documents/slice';
import { Pencil, Plus, Copy, Share2, Trash2, FileText } from 'lucide-react';
import { timeShortDisplay, formatDate } from 'utils/utils';
import { fieldsToResetOnDuplicate } from '../constants/documentFields';
import DocumentForm from './DocumentForm';
import { handlePdfGeneration, getDocumentTitle } from '../utils/documentUtils';
import { toast } from 'react-toastify';
import Spinner from './Spinner';

/**
 * Component for managing and displaying rental agreement documents associated with a specific apartment.
 * This component is specifically designed for landlord use cases, where documents are organized by apartment.
 */
class ApartmentDocumentList extends React.Component<DocumentListProps, DocumentListState> {
  state: DocumentListState = {
    showForm: false,
    editMode: false,
    duplicateTemplateFields: null,
  };

  /**
   * Fetches apartment documents when the component mounts
   */
  componentDidMount(): void {
    if (this.props.currentApartmentDetails.id) {
      this.props.getApartmentDocumentsThunk(this.props.currentApartmentDetails.id);
    }
  }

  /**
   * Fetches apartment documents when apartment ID changes
   * @param {DocumentListProps} prevProps - Previous component props
   */
  componentDidUpdate(prevProps: DocumentListProps) {
    if (this.props.currentApartmentDetails.id !== prevProps.currentApartmentDetails.id) {
      this.setState({ showForm: false });
      this.props.getApartmentDocumentsThunk(this.props.currentApartmentDetails.id);
    }
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { documents = [], loading, error, t } = this.props;
    const { showForm } = this.state;
    const isPendingLandlordSignature = (document: IDocument) => document.template_fields.tenantSignature && !document.template_fields.landlordSignature;
    const documentWasSigned = (document: IDocument) => !!document.template_fields.landlordSignature;

    return (
      <div className='page body-container'>
        <div className='header m-n-relation'>
          <span>{t('documents.title')}</span>
          {!this.state.showForm && (
            <button
              onClick={() => {
                this.props.setSelectedDocument(null);
                this.setState({ showForm: true, editMode: false, duplicateTemplateFields: null });
              }}
              className='action-button add'
            >
              <Plus />
            </button>
          )}
        </div>

        <div className='documents-container'>
          {showForm ? (
            <DocumentForm
              documentId={this.state.editMode ? this.props.selectedDocument?.document_id : undefined}
              initialTemplateFields={this.state.duplicateTemplateFields}
              onClose={() => this.setState({ showForm: false, editMode: false, duplicateTemplateFields: null })}
              apartmentId={this.props.currentApartmentDetails.id}
              apartmentInitiatedFields={{
                propertyAddress: this.props.currentApartmentDetails.address,
                roomCount: this.props.currentApartmentDetails.roomCount,
                rentAmount: this.props.currentApartmentDetails.rentAmount,
              }}
            />
          ) : (
            <div className='data-container'>
              {documents.length > 0 ? (
                documents.map((document) => (
                  <div key={document.document_id} className={`table-row document${(documentWasSigned(document) && ' signed') || ''}`}>
                    <div className='updated' data-title={t('common.fields.lastUpdated')} title={t('common.fields.lastUpdated')}>
                      {timeShortDisplay(new Date(document.updated_at))}
                    </div>
                    <div className='name' data-title={t('common.fields.name')} title={`Document ${document.document_id}`}>
                      '{getDocumentTitle(document.template_fields?.tenant1Name, t('documents.rentalAgreement'))}'
                    </div>
                    <div className='period' data-title={t('common.fields.period')} title={t('common.fields.period')}>
                      {formatDate(document.template_fields?.startDate)} - {formatDate(document.template_fields?.endDate)}
                    </div>

                    <div className='actions' data-title={t('common.fields.actions')}>
                      <button
                        className={`action-button edit${isPendingLandlordSignature(document) ? ' pending-signature' : ''}`}
                        title={`${isPendingLandlordSignature(document) ? t('documents.pendingLandlordSignature') : t('common.edit')}`}
                        onClick={async () => {
                          // First fetch the document
                          await this.props.getDocumentThunk(document.document_id);
                          // Then show the form
                          this.setState({ showForm: true, editMode: true });
                        }}
                      >
                        <Pencil />
                      </button>
                      <button className='action-button' title={t('common.tooltips.duplicate')} onClick={() => this.handleDuplicateDocument(document)}>
                        <Copy />
                      </button>
                      <button onClick={() => this.handleDeleteDocument(document)} className='action-button delete' title={t('common.delete')}>
                        <Trash2 />
                      </button>
                      <button
                        className='action-button documents'
                        title={t('documents.downloadPdf')}
                        onClick={async () => {
                          const pdfUrl: string | null = await handlePdfGeneration(document.document_id, this.props.JWT);
                          if (pdfUrl) window.open(pdfUrl, '_blank');
                          else toast.error(t('messages.error'));
                        }}
                      >
                        <FileText />
                      </button>
                      {!document.template_fields.tenant1Email /* the document was linked to a tenant - it's pointless and confusing to share it again */ && (
                        <button
                          className='action-button pdf'
                          title={t('documents.shareWhatsapp')}
                          onClick={async () => {
                            const pdf_url: string | null = await handlePdfGeneration(document.document_id, this.props.JWT);
                            if (pdf_url) this.handleShareViaWhatsApp(document.document_id, pdf_url);
                            else toast.error(t('messages.error'));
                          }}
                        >
                          <Share2 />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : loading ? (
                <Spinner />
              ) : error ? (
                <span className='error-message'>{error}</span>
              ) : (
                <div className='empty-message'>{t('documents.noDocumentsLandlord')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Shares document link via WhatsApp
   * @param {string} documentId - ID of document to share
   * @param {string} pdf_url - URL in CloudFront of the document to share
   */
  handleShareViaWhatsApp = (documentId: string, pdf_url: string) => {
    const { t } = this.props;
    const document = this.props.documents.find((d) => d.document_id === documentId);
    const message = t('apartmentDocuments.shareMessage', {
      title: getDocumentTitle(document?.template_fields?.tenant1Name, t('documents.rentalAgreement')),
      origin: window.location.origin,
      url: pdf_url,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  /**
   * Duplicates a document by copying all non-tenant fields
   * @param {IDocument} document - Document to duplicate
   */
  handleDuplicateDocument = async (document: IDocument) => {
    // First fetch the document to ensure we have latest data
    await this.props.getDocumentThunk(document.document_id);

    // Clear selected document since we're creating a new one
    this.props.setSelectedDocument(null);

    // Create a new template fields object without tenant fields
    const fromTemplateFields = { ...document.template_fields };
    fieldsToResetOnDuplicate.forEach((field) => {
      fromTemplateFields[field] = '';
    });

    // Show the form with duplicated fields
    this.setState({ showForm: true, editMode: false, duplicateTemplateFields: fromTemplateFields });
  };

  /**
   * Handles document deletion after user confirmation
   */
  handleDeleteDocument = async (document: IDocument) => {
    const { t } = this.props;
    if (
      window.confirm(t('apartmentDocuments.confirmDelete', { name: getDocumentTitle(document.template_fields?.tenant1Name, t('documents.rentalAgreement')) }))
    ) {
      try {
        await this.props.deleteDocumentThunk(document.document_id);
        toast.success(t('messages.documentDeleted'));
        // Refresh the documents list
        if (this.props.currentApartmentDetails.id) {
          await this.props.getApartmentDocumentsThunk(this.props.currentApartmentDetails.id);
        }
      } catch (error) {
        toast.error(t('messages.error'));
      }
    }
  };
}

/**
 * Props interface for ApartmentDocumentList component
 * @interface DocumentListProps
 */
interface DocumentListProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  tReady: boolean;
  currentApartmentDetails: {
    id: string;
    address: string;
    roomCount: number;
    rentAmount: number;
  };
  selectedDocument: IDocument | null;
  documents: IDocument[];
  loading: boolean;
  error: string | null;
  JWT: string | null;
  username: string | null;
  getDocumentThunk: (documentId: string) => void;
  getApartmentDocumentsThunk: (apartmentId: string) => void;
  deleteDocumentThunk: (documentId: string) => Promise<any>;
  setSelectedDocument: (document: IDocument | null) => void;
}

/**
 * Maps state to props for ApartmentDocumentList component
 */
const mapStateToProps = (state: RootState) => {
  const currentApartment = state.apartments.apartments.find((apt) => apt.apartment_id === state.apartments.currentApartmentId);
  return {
    selectedDocument: state.documents.selectedDocument,
    documents: state.documents.documents,
    loading: state.documents.loading,
    error: state.documents.error,
    JWT: state.auth.JWT,
    username: state.auth.userName,
    currentApartmentDetails: {
      id: state.apartments.currentApartmentId || '',
      address: currentApartment?.address ? `${currentApartment.address}${currentApartment.unit_number && `, ${currentApartment.unit_number}`}` : '',
      roomCount: currentApartment?.rooms_count || 0,
      rentAmount: currentApartment?.rent_amount || 0,
    },
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<RootState, undefined, AnyAction>) => ({
  getDocumentThunk: (documentId: string) => dispatch(getDocumentThunk(documentId)),
  getApartmentDocumentsThunk: (apartmentId: string) => dispatch(getApartmentDocumentsThunk(apartmentId)),
  deleteDocumentThunk: (documentId: string) => dispatch(deleteDocumentThunk(documentId)),
  setSelectedDocument: (document: IDocument | null) => dispatch(documentActions.setSelectedDocument(document)),
});

/**
 * State interface for ApartmentDocumentList component
 * @interface DocumentListState
 */
interface DocumentListState {
  showForm: boolean;
  editMode: boolean;
  duplicateTemplateFields: Record<string, any> | null;
}

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ApartmentDocumentList));
