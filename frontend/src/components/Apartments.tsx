import React from 'react';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { bindActionCreators, Dispatch } from 'redux';
import { IAppState } from '../redux/store/types';
import { IApartment } from '../redux/apartments/types';
import { UserType } from '../redux/auth/types';
import { setMenuSelectedPageAction } from '../redux/menu/actions';
import {
  prepareCreateApartmentCommandAction,
  setNoApartmentsNotifiedAction,
  addApartmentAction,
  setCurrentApartmentAction,
  setApartmentStateAction,
  setApartmentConfirmedByBackendAction,
  prepareUpdateApartmentCommandAction,
  prepareDeleteApartmentCommandAction,
  deleteApartmentAction,
  toggleApartmentFormAction,
  updateApartmentFieldAction,
  setApartmentFormErrorsAction,
  resetApartmentFormAction,
} from '../redux/apartments/actions';
import { clearApartmentActivityAction, prepareReadApartmentActivityCommandAction } from '../redux/apartmentActivity/actions';
import { Trash2, Pencil, FileText, Copy, Plus, List } from 'lucide-react';
import { filterAndSortApartments } from '../utils/utils';
import { ApartmentForm } from './ApartmentForm';
import ApartmentDocumentList from './ApartmentDocumentList';
import ApartmentActivity from './ApartmentActivity';
import { IDocument } from 'redux/documents/types';
import { toast } from 'react-toastify';

/**
 * Component for displaying and managing apartments
 * @class Apartments
 * @extends React.Component<IApartmentsProps, { showDocuments: boolean }>
 */
class Apartments extends React.Component<IApartmentsProps, { showDocuments: boolean }> {
  constructor(props: IApartmentsProps) {
    super(props);
    this.state = { showDocuments: true };
  }

  // Initialize focus and visibility change listeners
  componentDidMount() {
    setTimeout(() => {
      if (this.props.apartments.length === 0 && !this.props.noApartmentsNotified) {
        if (this.props.userType === UserType.Landlord) {
          this.props.setNoApartmentsNotifiedAction(true);
          this.props.toggleApartmentFormAction(true);
        }
      }
    }, 3000);
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { userType, showApartmentForm, isWsConnected, currentApartmentId, t } = this.props;
    const { showDocuments } = this.state;
    const filteredApartments = this.getFilteredApartments();

    return (
      <div className='body-container'>
        <div className={`page apartments-container${!isWsConnected ? ' disconnected' : ''}`}>
          <header className='header'>
            {!showApartmentForm ? t('apartments.title') : t('apartments.form')}
            <button onClick={() => this.props.toggleApartmentFormAction(!showApartmentForm)} className='action-button add'>
              {!showApartmentForm && <Plus />}
            </button>
          </header>
          <div className='data-container apartments-list'>
            {showApartmentForm ? (
              <ApartmentForm />
            ) : filteredApartments.length > 0 ? (
              filteredApartments.map((apartment) => (
                <div
                  key={apartment.apartment_id}
                  className={`table-row apartment${apartment.onroute ? ' onroute' : ''}${!apartment.is_disabled ? ' open' : ' is_disabled'}${
                    userType === UserType.Landlord ? ' isLandlord' : ''
                  }${apartment.apartment_id === currentApartmentId ? ' current' : ''}`}
                  onClick={() => this.handleApartmentClick(apartment.apartment_id)}
                  title={apartment.apartment_id}
                >
                  {apartment.updated_at && (
                    <div className='updated-at' data-title={t('common.fields.updatedAt')}>
                      {new Date(apartment.updated_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className='address' data-title={t('common.fields.address')}>
                    {`${apartment.address}, ${apartment.is_housing_unit ? t('apartments.fields.housingUnit') : t('apartments.fields.apartment')} ${
                      apartment.unit_number
                    }`}
                  </div>
                  <div className='rooms-count' data-title={t('common.roomCount')}>
                    {apartment.rooms_count}
                  </div>
                  <div className='rent-amount' data-title={t('apartments.fields.rentAmount')}>
                    {apartment.rent_amount.toLocaleString()}₪
                  </div>
                  <div className='actions'>
                    <button onClick={() => this.handleEditApartment(apartment)} className='action-button edit' title={t('common.edit')}>
                      <Pencil />
                    </button>
                    <button className='action-button' title={t('common.tooltips.duplicate')} onClick={() => this.handleDuplicateApartment(apartment)}>
                      <Copy />
                    </button>
                    <button onClick={() => this.handleDeleteApartment(apartment)} className='action-button delete' title={t('common.delete')}>
                      <Trash2 />
                    </button>
                    <button
                      onClick={() => this.handleToggleDocumentsActivity(apartment.apartment_id)}
                      className='action-button documents activity'
                      title={t('apartments.tooltips.toggleView', {
                        from: this.state.showDocuments ? t('documents.title') : t('apartmentActivity.title'),
                        to: this.state.showDocuments ? t('apartmentActivity.title') : t('documents.title'),
                      })}
                    >
                      {this.state.showDocuments ? <FileText /> : <List />}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className='empty-message'>{t('apartments.noApartments')}</div>
            )}
          </div>
        </div>

        {!showApartmentForm && filteredApartments.length > 0 && <>{showDocuments ? currentApartmentId && <ApartmentDocumentList /> : <ApartmentActivity />}</>}
      </div>
    );
  }

  /**
   * Filters and sorts apartments based on current criteria
   * @returns {IApartment[]} Filtered and sorted list of apartments
   */
  getFilteredApartments = (): IApartment[] => {
    return filterAndSortApartments(this.props.apartments);
  };

  /**
   * Toggles between documents and activity view
   */
  handleToggleDocumentsActivity = (apartment_id: string) => {
    const prevShowDocuments = this.state.showDocuments;
    this.setState((prevState) => ({ showDocuments: !prevState.showDocuments }));
    if (prevShowDocuments) this.props.prepareReadApartmentActivityCommandAction(apartment_id);
  };

  handleShowActivity = () => {
    this.setState({ showDocuments: false });
  };

  /**
   * Handles apartment selection and loads its activity
   * @param {string} apartment_id - ID of the selected apartment
   */
  handleApartmentClick = (apartment_id: string) => {
    // Only proceed if the apartment_id is different from current
    if (apartment_id !== this.props.currentApartmentId) this.props.setCurrentApartmentAction(apartment_id);

    // Send command to read apartment activity only if the component's state is to show activity.
    if (!this.state.showDocuments) this.props.prepareReadApartmentActivityCommandAction(apartment_id);
  };

  /**
   * Sets up apartment for editing
   * @param {IApartment} apartment - The apartment to edit
   */
  handleEditApartment = (apartment: IApartment) => {
    const { toggleApartmentFormAction, updateApartmentFieldAction } = this.props;

    toggleApartmentFormAction(true); // Ensure form is hidden first
    updateApartmentFieldAction('id', apartment.apartment_id);
    updateApartmentFieldAction('address', apartment.address);
    updateApartmentFieldAction('is_housing_unit', apartment.is_housing_unit);
    updateApartmentFieldAction('unit_number', apartment.unit_number);
    updateApartmentFieldAction('rooms_count', apartment.rooms_count);
    updateApartmentFieldAction('rent_amount', apartment.rent_amount);
    updateApartmentFieldAction('is_disabled', apartment.is_disabled);
  };

  /**
   * Duplicates an apartment
   * @param {IDocument} doc - Document to duplicate
   */
  handleDuplicateApartment = async (apartment: IApartment) => {
    const { toggleApartmentFormAction, updateApartmentFieldAction } = this.props;

    toggleApartmentFormAction(true);
    updateApartmentFieldAction('address', apartment.address);
    updateApartmentFieldAction('is_housing_unit', apartment.is_housing_unit);
    updateApartmentFieldAction('rooms_count', apartment.rooms_count);
    updateApartmentFieldAction('rent_amount', apartment.rent_amount);
  };

  /**
   * Deletes an apartment after confirmation
   * @param {IApartment} apartment - The apartment to delete
   */
  handleDeleteApartment = (apartment: IApartment) => {
    const { t } = this.props;

    if (this.props.currentApartmentDocuments.length > 0) toast.warn(t('apartments.warnDeleteWithData'));
    else if (window.confirm(t('apartments.confirmDelete'))) {
      this.props.prepareDeleteApartmentCommandAction(apartment.apartment_id);
      this.props.deleteApartmentAction(apartment.apartment_id);
    }
  };
}

/**
 * Props interface for Apartments component
 * @interface IApartmentsProps
 */
interface IApartmentsProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  tReady: boolean;
  isWsConnected: boolean;
  userType: UserType;
  userId: string | null;
  apartments: IApartment[];
  currentApartmentId: string | null;
  currentApartmentDocuments: IDocument[];
  noApartmentsNotified: boolean;
  showApartmentForm: boolean;
  setMenuSelectedPageAction: typeof setMenuSelectedPageAction;
  setNoApartmentsNotifiedAction: typeof setNoApartmentsNotifiedAction;
  prepareCreateApartmentCommandAction: typeof prepareCreateApartmentCommandAction;
  clearApartmentActivityAction: typeof clearApartmentActivityAction;
  prepareReadApartmentActivityCommandAction: typeof prepareReadApartmentActivityCommandAction;
  addApartmentAction: typeof addApartmentAction;
  setCurrentApartmentAction: typeof setCurrentApartmentAction;
  setApartmentStateAction: typeof setApartmentStateAction;
  setApartmentConfirmedByBackendAction: typeof setApartmentConfirmedByBackendAction;
  prepareUpdateApartmentCommandAction: typeof prepareUpdateApartmentCommandAction;
  prepareDeleteApartmentCommandAction: typeof prepareDeleteApartmentCommandAction;
  deleteApartmentAction: typeof deleteApartmentAction;
  toggleApartmentFormAction: typeof toggleApartmentFormAction;
  updateApartmentFieldAction: typeof updateApartmentFieldAction;
  setApartmentFormErrorsAction: typeof setApartmentFormErrorsAction;
  resetApartmentFormAction: typeof resetApartmentFormAction;
}

// Maps required state from Redux store to component props
const mapStateToProps = (state: IAppState) => ({
  userType: state.auth.userType,
  userId: state.auth.userId,
  isWsConnected: state.websockets.isConnected,
  apartments: state.apartments.apartments,
  currentApartmentId: state.apartments.currentApartmentId,
  currentApartmentDocuments: state.documents.documents,
  noApartmentsNotified: state.apartments.noApartmentsNotified,
  showApartmentForm: state.apartments.showApartmentForm,
});

// Map Redux actions to component props
const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      setMenuSelectedPageAction,
      prepareCreateApartmentCommandAction,
      clearApartmentActivityAction,
      prepareReadApartmentActivityCommandAction,
      setNoApartmentsNotifiedAction,
      addApartmentAction,
      setCurrentApartmentAction,
      setApartmentStateAction,
      setApartmentConfirmedByBackendAction,
      prepareUpdateApartmentCommandAction,
      prepareDeleteApartmentCommandAction,
      deleteApartmentAction,
      toggleApartmentFormAction,
      updateApartmentFieldAction,
      setApartmentFormErrorsAction,
      resetApartmentFormAction,
    },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Apartments));
