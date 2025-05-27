import React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { actions as documentActions } from '../redux/documents/slice';
import { RootState } from '../redux/store/reducers';
import { IDocument } from '../redux/documents/types';
import { getDocumentThunk, getTenantDocumentsThunk } from '../redux/documents/thunks';
import { Pencil, FileText, Plus, ArrowRight, Undo2, Share2 } from 'lucide-react';
import { timeShortDisplay, formatDate } from 'utils/utils';
import { getDocumentIdFromClipboard, isValidUUID, parseDocumentIdFromText } from '../utils/clipboard';
import DocumentForm from './DocumentForm';
import { handlePdfDownload, getDocumentTitle } from '../utils/documentUtils';
import { toast } from 'react-toastify';

/**
 * Component for displaying rental agreement documents associated with a tenant.
 * This component is specifically designed for tenant use cases, where documents are organized by tenant ID.
 */
class TenantDocumentList extends React.Component<DocumentListProps, DocumentListState> {
  state: DocumentListState = {
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
      getTenantDocumentsThunk(userId);
    }
  }

  /**
   * Fetches tenant documents when user ID changes
   * @param {DocumentListProps} prevProps - Previous component props
   */
  private findObjectDifferences(obj1: any, obj2: any, path: string = ''): any {
    if (obj1 === obj2) return {};
    if (!obj1 || !obj2) return { [path.slice(1)]: { from: obj1, to: obj2 } };
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return { [path.slice(1)]: { from: obj1, to: obj2 } };
    }

    const diffs: any = {};

    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) {
        return { [path.slice(1)]: { from: obj1, to: obj2 } };
      }
      // For arrays, compare each element
      obj1.forEach((item, index) => {
        const elementDiffs = this.findObjectDifferences(item, obj2[index], `${path}.${index}`);
        Object.assign(diffs, elementDiffs);
      });
      return diffs;
    }

    // Handle objects
    const allKeys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]));
    for (const key of allKeys) {
      if (obj1[key] !== obj2[key]) {
        const newPath = path ? `${path}.${key}` : `.${key}`;
        const diff = this.findObjectDifferences(obj1[key], obj2[key], newPath);
        Object.assign(diffs, diff);
      }
    }

    return diffs;
  }

  componentDidUpdate(prevProps: DocumentListProps) {
    const { userId, getTenantDocumentsThunk, t } = this.props;

    // Compare props recursively and show only changes
    // const differences = this.findObjectDifferences(prevProps, this.props);
    // if (Object.keys(differences).length > 0) {
    //   console.log(`Changed props: ${JSON.stringify(differences, null, 2)}, state: ${JSON.stringify(this.state, null, 2)}`);
    // }

    // Fetch the document when userId exists for the first time, or changes
    if (userId && (!prevProps.userId || userId !== prevProps.userId)) getTenantDocumentsThunk(userId);

    if (this.props.selectedDocument && (!prevProps.selectedDocument || prevProps.selectedDocument.document_id !== this.props.selectedDocument.document_id)) {
      const template_fields = this.props.selectedDocument.template_fields;
      // the selected document is either not linked yet or already linked to the current tenant:
      if (!template_fields.tenant1Email || template_fields.tenant1Email.toLowerCase() === this.props.email.toLowerCase())
        this.setState({ showDocumentIdInput: false });
      else {
        toast.error(t('tenantDocuments.errorLinkedEmail'));
        this.setState({ showDocumentIdInput: true, documentIdInput: '' });
      }
    } else if (!this.props.loading && prevProps.loading) {
      // no documments yet - open the new document id form:
      if (this.props.documents.length === 0 && !this.props.selectedDocument) {
        this.setState({ showDocumentIdInput: true });
      } // if selected document changed, update the edit mode:
    }
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { documents = [], error, t } = this.props;
    const { showDocumentIdInput, documentIdInput } = this.state;
    const documentWasSigned = (document: IDocument) => !!document.template_fields.landlordSignature;

    return (
      <div className='page body-container' id='tenant-documents'>
        <header className='header'>
          {t('documents.title')}
          {!this.state.showDocumentIdInput && !this.props.selectedDocument && (
            <button className='action-button add' onClick={() => this.setState({ showDocumentIdInput: true })}>
              <Plus />
            </button>
          )}
        </header>

        <div className='documents-container'>
          {showDocumentIdInput ? (
            <div className='document-id-input-container'>
              <div className='input-and-error-container'>
                <textarea
                  autoFocus
                  rows={4}
                  value={documentIdInput}
                  onChange={(e) => this.handleDocumentIdExtraction(e.target.value)}
                  onFocus={() => this.handleDocumentIdExtraction()}
                  onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
                    const text = e.clipboardData.getData('text');
                    this.handleDocumentIdExtraction(text);
                  }}
                  onKeyDown={this.handleKeyDown}
                  placeholder={t('tenantDocuments.documentIdPlaceholder')}
                  className='document-id-input'
                />
                {error && <span className='error-message'>{error}</span>}
              </div>
              <div className='actions'>
                <button
                  className={`action-button save${documentIdInput ? ' has-changes' : ''}${isValidUUID(documentIdInput) ? ' valid-uuid' : ''}`}
                  title={t('common.save')}
                  onClick={this.handleSubmit}
                >
                  <ArrowRight />
                </button>
                <button
                  className='action-button cancel'
                  title={t('common.cancel')}
                  onClick={() => {
                    if (this.state.documentIdInput) this.setState({ documentIdInput: '' });
                    else this.setState({ showDocumentIdInput: false });
                  }}
                >
                  <Undo2 />
                </button>
              </div>
            </div>
          ) : this.props.selectedDocument ? (
            <DocumentForm
              documentId={this.props.selectedDocument.document_id}
              onClose={async () => {
                this.setState({ editMode: false, documentIdInput: '' });
                this.props.setSelectedDocument(null);
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
                    <div className='name' data-title={t('common.fields.name')}>
                      '{getDocumentTitle(document.template_fields?.tenant1Name, t('documents.rentalAgreement'))}'
                    </div>
                    <div className='period' data-title={t('common.fields.period')} title={t('common.fields.period')}>
                      {formatDate(document.template_fields?.startDate)} - {formatDate(document.template_fields?.endDate)}
                    </div>
                    <div className='actions' data-title={t('common.fields.actions')}>
                      <button
                        className={`action-button edit${!document.template_fields.tenantSignature ? ' pending-signature' : ''}`}
                        title={t('common.edit')}
                        onClick={async () => {
                          await this.props.getDocumentThunk(document.document_id);
                          this.setState({ editMode: true });
                        }}
                      >
                        <Pencil />
                      </button>

                      <button
                        className='action-button pdf'
                        title={t('documents.downloadPdf')}
                        onClick={async () => {
                          const pdfUrl: string | null = await handlePdfDownload(document.document_id, this.props.JWT);
                          if (pdfUrl) window.open(pdfUrl, '_blank');
                          else toast.error(t('messages.error'));
                        }}
                      >
                        <FileText />
                      </button>

                      {!!document.template_fields.tenantSignature &&
                        !document.template_fields.landlordSignature /* the document was signed by the tenant and not yet by the landlord */ && (
                          <button
                            className='action-button share'
                            title={t('documents.shareWhatsapp')}
                            onClick={async () => {
                              const pdf_url: string | null = await handlePdfDownload(document.document_id, this.props.JWT);
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
              ) : (
                <div className='empty-message'>{t('documents.noDocumentsTenant')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Handles click on document ID input
   */
  handleDocumentIdExtraction = async (manualInput: string | null = null) => {
    // console.log('handleDocumentIdExtraction:', manualInput);
    if (manualInput) {
      const documentIdInput = parseDocumentIdFromText(manualInput);
      this.setState({ documentIdInput: documentIdInput || manualInput });
    } else {
      const { documentId, text } = await getDocumentIdFromClipboard();
      // console.log('handleDocumentIdExtraction:', { documentId, text });
      if (documentId) {
        this.setState({ documentIdInput: documentId });
        await this.fetchDocument(documentId);
      } else if (text) this.setState({ documentIdInput: text });
    }
  };

  /**
   * Handles key press in document ID input
   * @param {React.KeyboardEvent<HTMLInputElement>} e - The keyboard event
   */
  handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') this.handleSubmit();
  };

  /**
   * Handles document ID submission
   */
  handleSubmit = async () => {
    const { documentIdInput } = this.state;
    // console.log('handleSubmit:', documentIdInput);
    if (documentIdInput) await this.fetchDocument(documentIdInput);
  };

  /**
   * Helper method to fetch a document
   * @param {string} documentId - The document ID to fetch
   */
  fetchDocument = async (documentId: string) => {
    try {
      await this.props.getDocumentThunk(documentId);
    } catch (error) {
      toast.error(this.props.t('tenantDocuments.fetchError'));
    }
  };

  /**
   * Shares document link via WhatsApp
   * @param {string} documentId - ID of document to share
   * @param {string} pdf_url - URL in CloudFront of the document to share
   */
  handleShareViaWhatsApp = (documentId: string, pdf_url: string) => {
    const { t } = this.props;
    const document = this.props.documents.find((d) => d.document_id === documentId);
    const message = t('tenantDocuments.shareMessage', {
      title: getDocumentTitle(document?.template_fields?.tenant1Name, t('documents.rentalAgreement')),
      url: pdf_url,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };
}

/**
 * Props interface for TenantDocumentList component
 * @interface DocumentListProps
 */
interface DocumentListProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  tReady: boolean;
  JWT: string;
  userId: string;
  email: string;
  selectedDocument: IDocument | null;
  documents: IDocument[];
  loading: boolean;
  error: string | null;
  getDocumentThunk: (documentId: string) => void;
  getTenantDocumentsThunk: (tenantUserId: string) => void;
  setSelectedDocument: (document: IDocument | null) => void;
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
  editMode: boolean;
  showDocumentIdInput: boolean;
  documentIdInput: string;
}

const mapDispatchToProps = (dispatch: ThunkDispatch<RootState, undefined, AnyAction>) => ({
  getDocumentThunk: (documentId: string) => dispatch(getDocumentThunk(documentId)),
  getTenantDocumentsThunk: (tenantUserId: string) => dispatch(getTenantDocumentsThunk(tenantUserId)),
  setSelectedDocument: (document: IDocument | null) => dispatch(documentActions.setSelectedDocument(document)),
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(TenantDocumentList));
