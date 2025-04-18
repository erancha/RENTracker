import React from 'react';
import { connect } from 'react-redux';
import { RootState } from '../redux/store/reducers';
import { IDocument } from '../redux/documents/types';
import { getDocumentThunk, getTenantDocumentsThunk } from '../redux/documents/thunks';
import { Pencil, FileText, Plus, ArrowRight, Undo2 } from 'lucide-react';
import Spinner from './Spinner';
import { timeShortDisplay, formatDate } from 'utils/utils';
import DocumentForm from './DocumentForm';
import { handlePdfGeneration, getDocumentTitle } from '../utils/documentUtils';
import { toast } from 'react-toastify';

/**
 * Component for displaying rental agreement documents associated with a tenant.
 * This component is specifically designed for tenant use cases, where documents are organized by tenant ID.
 */
class TenantDocumentList extends React.Component<DocumentListProps, DocumentListState> {
  private fetchedTenantId: string | null = null;

  state: DocumentListState = {
    showForm: false,
    editMode: false,
    showDocumentIdInput: false,
    documentIdInput: '',
  };

  /**
   * Fetches tenant documents when component mounts
   */
  componentDidMount() {
    const { userId, getTenantDocumentsThunk } = this.props;
    if (userId) {
      this.fetchedTenantId = userId;
      getTenantDocumentsThunk(userId);
    }
  }

  /**
   * Fetches tenant documents when user ID changes
   * @param {DocumentListProps} prevProps - Previous component props
   */
  componentDidUpdate(prevProps: DocumentListProps) {
    const { userId, getTenantDocumentsThunk } = this.props;
    // Fetch when userId becomes available or changes
    if (userId && (!prevProps.userId || userId !== prevProps.userId)) {
      this.fetchedTenantId = userId;
      getTenantDocumentsThunk(userId);
    }

    // console.log(JSON.stringify(this.props, null, 2), JSON.stringify(prevProps, null, 2));

    if (!this.props.loading && prevProps.loading) {
      if (this.props.selectedDocument) {
        if (
          !this.props.selectedDocument.template_fields.tenantEmail ||
          this.props.selectedDocument.template_fields.tenantEmail.toLowerCase() === this.props.email.toLowerCase()
        )
          this.setState({ showDocumentIdInput: false, showForm: true });
        else {
          toast.error(`You cannot edit this document. It is linked to ${this.props.selectedDocument.template_fields.tenantEmail}`);
          navigator.clipboard.writeText('').catch(() => {}); // Clear clipboard
          this.setState({
            showDocumentIdInput: true,
            showForm: false,
            documentIdInput: '',
          });
        }
      } else if (this.props.documents.length === 0) {
        this.setState({ showDocumentIdInput: true });
      }
    } else if (this.props.error) {
      navigator.clipboard.writeText('').catch(() => {}); // Clear clipboard
    }
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { documents = [], loading, error } = this.props;
    const { showForm, showDocumentIdInput, documentIdInput } = this.state;

    return (
      <div className='page body-container'>
        <div className='header documents-container-header'>
          Tenant Rental Agreements
          <button className='action-button add' onClick={() => this.setState({ showDocumentIdInput: true })}>
            {!this.state.showDocumentIdInput && <Plus />}
          </button>
        </div>

        <div className='documents-container'>
          {loading ? (
            <Spinner />
          ) : showDocumentIdInput ? (
            <div className='document-id-input-container'>
              <div className='input-and-error-container'>
                <textarea
                  autoFocus
                  rows={2}
                  value={documentIdInput}
                  onChange={(e) => this.setState({ documentIdInput: e.target.value })}
                  onKeyDown={this.handleKeyDown}
                  onFocus={this.handleFocus}
                  placeholder='Enter Document ID or paste WhatsApp message'
                  className='document-id-input'
                />
                {error && <span className='error-message'>{error}</span>}
              </div>
              <button className='action-button save' title='Save' onClick={this.handleSubmit}>
                <ArrowRight />
              </button>
              <button className='action-button cancel' title='Cancel' onClick={() => this.setState({ showDocumentIdInput: false })}>
                <Undo2 />
              </button>
            </div>
          ) : showForm ? (
            <DocumentForm documentId={this.props.selectedDocument?.document_id} onClose={() => this.setState({ showForm: false, editMode: false })} />
          ) : (
            <div className='data-container'>
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <div key={doc.document_id} className='table-row document'>
                    <div className='updated' data-title='Last Updated'>
                      {timeShortDisplay(new Date(doc.updated_at))}
                    </div>
                    <div className='name' data-title='Name'>
                      '{getDocumentTitle(doc.template_fields?.tenantName)}'
                    </div>
                    <div className='period' data-title='Period'>
                      {formatDate(doc.template_fields?.startDate)} - {formatDate(doc.template_fields?.endDate)}
                    </div>
                    <div className='actions' data-title='Actions'>
                      <button
                        className='action-button'
                        title='Edit'
                        onClick={async () => {
                          await this.props.getDocumentThunk(doc.document_id);
                          this.setState({ showForm: true, editMode: true });
                        }}
                      >
                        <Pencil />
                      </button>
                      <button
                        className='action-button documents'
                        title='Download PDF'
                        onClick={async () => {
                          const pdfUrl: string | null = await handlePdfGeneration(doc.document_id, this.props.JWT);
                          if (pdfUrl) window.open(pdfUrl, '_blank');
                          else toast.error('Failed to generate PDF');
                        }}
                      >
                        <FileText />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className='empty-message'>No documents found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Handles key press in document ID input
   * @param {React.KeyboardEvent<HTMLInputElement>} e - The keyboard event
   */
  handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
    }
  };

  /**
   * Extracts document ID from a WhatsApp message
   * @param {string} message - The WhatsApp message containing document ID
   * @returns {string|null} The extracted document ID or null if not found
   */
  extractDocumentId = (message: string): string | null => {
    // Match document ID between the last forward slash and '-rental-agreement'
    const match = message.match(/\/([0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12})-rental-agreement/i);
    return match ? match[1] : null;
  };

  /**
   * Handles click on document ID input
   */
  handleFocus = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const documentId = this.extractDocumentId(text);
      if (documentId) {
        this.setState({ documentIdInput: documentId });
        this.props.getDocumentThunk(documentId.trim());
      }
    } catch (error) {
      // Ignore clipboard read errors
    }
  };

  /**
   * Handles document ID submission
   */
  handleSubmit = async () => {
    const { documentIdInput } = this.state;
    if (!documentIdInput.trim()) return;

    try {
      this.props.getDocumentThunk(documentIdInput.trim());
    } catch (error) {
      toast.error('Failed to fetch document. Please check the ID and try again.');
    }
  };
}

/**
 * Props interface for TenantDocumentList component
 * @interface DocumentListProps
 */
interface DocumentListProps {
  JWT: string;
  userId: string;
  email: string;
  selectedDocument: IDocument | null;
  documents: IDocument[];
  loading: boolean;
  error: string | null;
  getDocumentThunk: (documentId: string) => void;
  getTenantDocumentsThunk: (tenantUserId: string) => void;
}

/**
 * Maps state to props for TenantDocumentList component
 */
const mapStateToProps = (state: RootState) => ({
  JWT: state.auth.JWT as string,
  userId: state.auth.userId as string,
  email: state.auth.email as string,
  selectedDocument: state.documents.selectedDocument,
  documents: state.documents.documents,
  loading: state.documents.loading,
  error: state.documents.error,
});

/**
 * State interface for TenantDocumentList component
 * @interface DocumentListState
 */
interface DocumentListState {
  showForm: boolean;
  editMode: boolean;
  showDocumentIdInput: boolean;
  documentIdInput: string;
}

export default connect(mapStateToProps, { getDocumentThunk, getTenantDocumentsThunk })(TenantDocumentList);
