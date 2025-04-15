import React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';
import { RootState } from '../redux/store/reducers';
import { IDocument } from '../redux/documents/types';
import { getDocumentThunk, getApartmentDocumentsThunk, deleteDocumentThunk } from '../redux/documents/thunks';
import { actions as documentActions } from '../redux/documents/slice';
import { Pencil, Plus, Copy, Share2, Trash2, FileText } from 'lucide-react';
import Spinner from './Spinner';
import { timeShortDisplay, formatDate } from 'utils/utils';
import { fieldsToResetOnDuplicate } from '../constants/documentFields';
import DocumentForm from './DocumentForm';
import { handlePdfGeneration, getDocumentTitle } from '../utils/documentUtils';
import { toast } from 'react-toastify';

/**
 * Component for managing and displaying rental agreement documents associated with a specific apartment.
 * This component is specifically designed for landlord use cases, where documents are organized by apartment.
 */
class ApartmentDocumentList extends React.Component<DocumentListProps, DocumentListState> {
  private fetchedApartmentId: string | null = null;

  state: DocumentListState = {
    showForm: false,
    editMode: false,
    duplicateTemplateFields: null,
    sectionsToExpand: [],
  };

  /**
   * Fetches apartment documents when component mounts
   */
  componentDidMount() {
    const { apartmentId, getApartmentDocumentsThunk } = this.props;
    if (apartmentId !== this.fetchedApartmentId) {
      this.fetchedApartmentId = apartmentId;
      getApartmentDocumentsThunk(apartmentId);
    }
  }

  /**
   * Fetches apartment documents when apartment ID changes
   * @param {DocumentListProps} prevProps - Previous component props
   */
  componentDidUpdate(prevProps: DocumentListProps) {
    const { apartmentId, getApartmentDocumentsThunk } = this.props;
    if (apartmentId !== this.fetchedApartmentId) {
      this.fetchedApartmentId = apartmentId;
      getApartmentDocumentsThunk(apartmentId);
    }
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { documents = [], loading, error } = this.props;
    const { showForm } = this.state;

    return (
      <div className='page body-container'>
        <div className='header documents-container-header'>
          Rental Agreements
          {!this.state.showForm && (
            <button
              onClick={() => {
                // Reset the selected document to ensure form starts fresh
                this.props.setSelectedDocument(null);
                this.setState({
                  showForm: true,
                  editMode: false,
                  duplicateTemplateFields: null,
                  sectionsToExpand: [],
                });
              }}
              className='action-button add'
            >
              <Plus />
            </button>
          )}
        </div>
        <div className='documents-container'>
          {loading ? (
            <Spinner />
          ) : error ? (
            <span className='error-message'>{error}</span>
          ) : showForm ? (
            <DocumentForm
              documentId={this.props.selectedDocument?.document_id}
              onClose={() => this.setState({ showForm: false, editMode: false, duplicateTemplateFields: null, sectionsToExpand: [] })}
              apartmentId={this.props.apartmentId}
              apartmentInitiatedFields={{
                propertyAddress: this.props.apartmentAddress,
                roomsCount: this.props.roomsCount,
                rentAmount: this.props.rentAmount,
              }}
              initialTemplateFields={this.state.duplicateTemplateFields}
              expandedSections={this.state.sectionsToExpand}
            />
          ) : (
            <div className='data-container'>
              {documents.length > 0 ? (
                documents.map((document) => (
                  <div key={document.document_id} className='table-row document'>
                    <div className='updated' data-title='Last Updated'>
                      {timeShortDisplay(new Date(document.updated_at))}
                    </div>
                    <div className='name' data-title='Name'>
                      '{getDocumentTitle(document.template_fields?.tenantName)}'
                    </div>
                    <div className='period' data-title='Period'>
                      {formatDate(document.template_fields?.startDate)} - {formatDate(document.template_fields?.endDate)}
                    </div>
                    <div className='actions' data-title='Actions'>
                      <button
                        className='action-button'
                        title='Edit'
                        onClick={async () => {
                          // First fetch the document
                          await this.props.getDocumentThunk(document.document_id);
                          // Then show the form
                          this.setState({ showForm: true, editMode: true });
                        }}
                      >
                        <Pencil />
                      </button>
                      <button className='action-button' title='Duplicate' onClick={() => this.handleDuplicateDocument(document)}>
                        <Copy />
                      </button>
                      <button onClick={() => this.handleDeleteDocument(document)} className='action-button delete' title='Delete'>
                        <Trash2 />
                      </button>
                      <button
                        className='action-button documents'
                        title='Download PDF'
                        onClick={async () => {
                          const pdfUrl: string | null = await handlePdfGeneration(document.document_id, this.props.JWT);
                          if (pdfUrl) window.open(pdfUrl, '_blank');
                          else toast.error('Failed to generate PDF');
                        }}
                      >
                        <FileText />
                      </button>
                      <button
                        className='action-button pdf'
                        title='Share via WhatsApp'
                        onClick={async () => {
                          const pdfUrl: string | null = await handlePdfGeneration(document.document_id, this.props.JWT);
                          if (pdfUrl) this.handleShareWhatsApp(document.document_id, pdfUrl);
                          else toast.error('Failed to generate PDF');
                        }}
                      >
                        <Share2 />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className='empty-message'>No documents found. Create a new rental agreement ...</div>
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
   */
  handleShareWhatsApp = (documentId: string, pdfUrl: string) => {
    const document = this.props.documents.find((d) => d.document_id === documentId);
    const message = `PFA *'${getDocumentTitle(document?.template_fields?.tenantName)}'* :\n\t${
      window.location.origin === 'http://localhost:3000' ? pdfUrl : `${window.location.origin}/${pdfUrl.substring(pdfUrl.indexOf('documents'))}`
    }.\n\nTo complete tenant information, visit: ${window.location.origin} and copy/paste the current message.`;
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
    const templateFields = { ...document.template_fields };
    fieldsToResetOnDuplicate.forEach((field) => {
      templateFields[field] = '';
    });
    const currentDate = new Date();
    templateFields['date'] = currentDate.toISOString().split('T')[0];
    templateFields['startDate'] = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1, 12).toISOString().split('T')[0]; // + 12 hours to normalize the time zone.

    // Determine which sections need to be expanded based on reset fields
    const sectionsToExpand = new Set(['basic', 'leaseTerms']); // These sections contain the reset fields

    // Show the form with duplicated fields
    this.setState({
      showForm: true,
      editMode: false,
      duplicateTemplateFields: templateFields,
      sectionsToExpand: Array.from(sectionsToExpand),
    });
  };

  /**
   * Handles document deletion after user confirmation
   */
  handleDeleteDocument = async (document: IDocument) => {
    if (window.confirm(`Are you sure you want to delete document '${getDocumentTitle(document.template_fields?.tenantName)}'?`)) {
      try {
        await this.props.deleteDocumentThunk(document.document_id);
        toast.success('Document deleted successfully');
        // Refresh the documents list
        if (this.props.apartmentId) {
          await this.props.getApartmentDocumentsThunk(this.props.apartmentId);
        }
      } catch (error) {
        toast.error('Failed to delete document');
      }
    }
  };
}

/**
 * Props interface for ApartmentDocumentList component
 * @interface DocumentListProps
 */
interface DocumentListProps {
  apartmentId: string;
  apartmentAddress: string;
  roomsCount: number;
  rentAmount: number;
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
    apartmentId: state.apartments.currentApartmentId || '',
    apartmentAddress: currentApartment?.address || '',
    roomsCount: currentApartment?.rooms_count || 0,
    rentAmount: currentApartment?.rent_amount || 0,
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
  sectionsToExpand: string[];
}

export default connect(mapStateToProps, mapDispatchToProps)(ApartmentDocumentList);
