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
import { v4 as uuidv4 } from 'uuid';

/**
 * Component for displaying and managing apartments
 * @class Apartments
 * @extends React.Component<IApartmentsProps, { showDocuments: boolean }>
 */
class Apartments extends React.Component<IApartmentsProps, { showDocuments: boolean }> {
  // Refs for form elements
  private newApartmentInputRef = React.createRef<HTMLInputElement>();
  private currentApartmentRef = React.createRef<HTMLInputElement>();

  constructor(props: IApartmentsProps) {
    super(props);
    this.state = {
      showDocuments: true,
    };
  }

  // Initialize focus and visibility change listeners
  componentDidMount() {
    setTimeout(() => {
      if (this.props.apartments.length === 0 && !this.props.noApartmentsNotified) {
        if (this.props.userType === UserType.Landlord) {
          this.props.setNoApartmentsNotifiedAction(true);
          this.props.toggleApartmentFormAction(true);
          setTimeout(() => this.newApartmentInputRef.current?.focus(), 1000);
        }
      }
    }, 3000);

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handles visibility change to focus on new apartment input
   */
  handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') setTimeout(() => this.newApartmentInputRef.current?.focus(), 1000);
  };

  componentDidUpdate(prevProps: IApartmentsProps) {
    if (prevProps.currentApartmentId !== this.props.currentApartmentId) {
      setTimeout(() => {
        const currentElement = this.currentApartmentRef.current;
        if (currentElement) {
          currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          currentElement.focus();
        }
      }, 100);
    }
  }

  /**
   * Renders the component
   * @returns {JSX.Element} The rendered component
   */
  render() {
    const { userType, showApartmentForm, toggleApartmentFormAction, resetApartmentFormAction, isWsConnected, currentApartmentId, apartmentForm, t } =
      this.props;
    const { showDocuments } = this.state;
    const filteredApartments = this.getFilteredApartments();

    return (
      <div className='body-container'>
        <div className={`page apartments-container${!isWsConnected ? ' disconnected' : ''}`}>
          <div className='header'>
            {!showApartmentForm ? t('apartments.title') : t('apartments.form')}
            <button onClick={() => toggleApartmentFormAction(!showApartmentForm)} className='action-button add'>
              {!showApartmentForm && <Plus />}
            </button>
          </div>
          <div className='data-container apartments-list'>
            {showApartmentForm ? (
              <ApartmentForm
                mode={apartmentForm.id ? 'update' : 'create'}
                initialValues={{
                  address: apartmentForm.address,
                  unit_number: apartmentForm.unit_number,
                  rooms_count: apartmentForm.rooms_count,
                  rent_amount: apartmentForm.rent_amount,
                  is_disabled: apartmentForm.is_disabled,
                }}
                errors={apartmentForm.errors}
                onSubmit={apartmentForm.id ? this.handleUpdateApartment : this.handleCreateApartment}
                onCancel={() => {
                  toggleApartmentFormAction(false);
                  resetApartmentFormAction();
                }}
                inputRef={this.newApartmentInputRef}
              />
            ) : filteredApartments.length > 0 ? (
              filteredApartments.map((apartment) => (
                <div
                  key={apartment.apartment_id}
                  className={`table-row apartment${apartment.onroute ? ' onroute' : ''}${!apartment.is_disabled ? ' open' : ' is_disabled'}${
                    userType === UserType.Landlord ? ' isLandlord' : ''
                  }${apartment.apartment_id === currentApartmentId ? ' current' : ''}`}
                  onClick={() => this.handleApartmentClick(apartment.apartment_id)}
                  ref={apartment.apartment_id === currentApartmentId ? this.currentApartmentRef : undefined}
                  title={apartment.apartment_id}
                >
                  {apartment.updated_at && (
                    <div className='updated-at' data-title={t('common.fields.updatedAt')}>
                      {new Date(apartment.updated_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className='address' data-title={t('common.fields.address')}>
                    {apartment.address} {apartment.unit_number && `(${apartment.unit_number})`}
                  </div>
                  <div className='rooms-count' data-title={t('common.roomCount')}>
                    {apartment.rooms_count}
                  </div>
                  <div className='rent-amount' data-title={t('apartments.fields.rentAmount')}>
                    {apartment.rent_amount.toLocaleString()}₪
                  </div>
                  {/* {[UserType.Landlord, UserType.Admin].includes(userType) && ( */}
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
                    {this.renderDocumentsToggleButton(apartment.apartment_id)}
                  </div>
                  {/* )} */}
                </div>
              ))
            ) : (
              <div className='empty-message'>{this.props.t('apartments.noApartments')}</div>
            )}
          </div>
        </div>

        {!showApartmentForm && filteredApartments.length > 0 && (
          <>{showDocuments ? <div className='documents-container'>{currentApartmentId && <ApartmentDocumentList />}</div> : <ApartmentActivity />}</>
        )}
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
   * Renders the documents/activity toggle button
   * @returns {JSX.Element} Button with appropriate styling based on state
   */
  renderDocumentsToggleButton = (apartment_id: string) => (
    <button
      onClick={() => this.handleToggleDocumentsActivity(apartment_id)}
      className='action-button documents activity'
      title={this.props.t('apartments.tooltips.toggleView', {
        from: this.state.showDocuments ? 'Rental Agreements' : 'Activity',
        to: this.state.showDocuments ? 'Activity' : 'Rental Agreements',
      })}
    >
      {this.state.showDocuments ? <FileText /> : <List />}
    </button>
  );

  /**
   * Toggles between documents and activity view
   */
  handleToggleDocumentsActivity = (apartment_id: string) => {
    // toggle only if the apartment_id of the current apartment is the same as the apartment_id last saved in redux (to avoid toggling when the user just wants to select another apartment)
    if (apartment_id === this.props.currentApartmentId) {
      const prevShowDocuments = this.state.showDocuments;
      this.setState((prevState) => ({ showDocuments: !prevState.showDocuments }));
      if (prevShowDocuments) this.props.prepareReadApartmentActivityCommandAction(apartment_id);
    }
  };

  handleShowActivity = () => {
    this.setState({ showDocuments: false });
  };

  /**
   * Creates a new apartment if form validation passes
   * @param {object} values - Form values for new apartment
   */
  handleCreateApartment = (values: { address: string; unit_number: string; rooms_count: number; rent_amount: number }) => {
    const errors = this.validateForm(values);

    if (Object.keys(errors).length === 0) {
      const apartment_id = uuidv4();
      this.props.prepareCreateApartmentCommandAction(apartment_id, values.address, values.unit_number, values.rooms_count, values.rent_amount);
      this.props.toggleApartmentFormAction(false);
      this.props.addApartmentAction({
        ...values,
        apartment_id,
        onroute: true,
        is_disabled: false,
        user_id: this.props.userId || '',
      });
      this.props.resetApartmentFormAction();
      this.props.setCurrentApartmentAction(apartment_id);
      this.props.clearApartmentActivityAction();
    } else {
      this.props.setApartmentFormErrorsAction(errors);
    }
  };

  /**
   * Validates apartment form fields
   * @param {object} values - Form values to validate
   * @returns {Record<string, string>} Validation errors if any
   */
  validateForm = (values: { address: string; rooms_count: number; rent_amount: number }) => {
    const errors: Record<string, string> = {};
    const { t } = this.props;

    if (!values.address) errors.address = t('validation.required');

    if (!values.rooms_count) errors.rooms_count = t('validation.required');
    else if (values.rooms_count < 1 || values.rooms_count > 20 || values.rooms_count % 0.5 !== 0) errors.rooms_count = t('validation.roomsCount');

    if (!values.rent_amount || values.rent_amount <= 0) errors.rent_amount = t('validation.required');

    return errors;
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
    updateApartmentFieldAction('unit_number', apartment.unit_number);
    updateApartmentFieldAction('rooms_count', apartment.rooms_count);
    updateApartmentFieldAction('rent_amount', apartment.rent_amount);
    updateApartmentFieldAction('is_disabled', apartment.is_disabled);
  };

  /**
   * Updates an existing apartment if validation passes
   * @param {object} values - Updated apartment values
   */
  handleUpdateApartment = (values: { address: string; unit_number: string; rooms_count: number; rent_amount: number; is_disabled?: boolean }) => {
    const { prepareUpdateApartmentCommandAction, apartmentForm, setApartmentStateAction, setApartmentFormErrorsAction } = this.props;

    // Validate form
    const errors = this.validateForm(values);

    if (Object.keys(errors).length === 0) {
      if (apartmentForm.id) {
        // Update local state first (in redux)
        setApartmentStateAction({
          ...values,
          apartment_id: apartmentForm.id,
          onroute: true,
          is_disabled: values.is_disabled ?? false,
        });

        // Send update command (to the backend)
        prepareUpdateApartmentCommandAction(apartmentForm.id, {
          ...values,
          is_disabled: values.is_disabled ?? false,
        });

        // Reset form state
        this.props.toggleApartmentFormAction(false);
        this.props.resetApartmentFormAction();
      }
    } else {
      setApartmentFormErrorsAction(errors);
    }
  };

  /**
   * Duplicates an apartment
   * @param {IDocument} doc - Document to duplicate
   */
  handleDuplicateApartment = async (apartment: IApartment) => {
    this.props.toggleApartmentFormAction(true);
    this.props.updateApartmentFieldAction('address', apartment.address);
    this.props.updateApartmentFieldAction('rooms_count', apartment.rooms_count);
    this.props.updateApartmentFieldAction('rent_amount', apartment.rent_amount);
  };

  /**
   * Deletes an apartment after confirmation
   * @param {IApartment} apartment - The apartment to delete
   */
  handleDeleteApartment = (apartment: IApartment) => {
    if (window.confirm(this.props.t('apartments.confirmDelete'))) {
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
  noApartmentsNotified: boolean;
  showApartmentForm: boolean;
  apartmentForm: {
    id: string;
    address: string;
    unit_number: string;
    rooms_count: number;
    rent_amount: number;
    is_disabled: boolean;
    errors: Record<string, string>;
  };
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
  noApartmentsNotified: state.apartments.noApartmentsNotified,
  showApartmentForm: state.apartments.showApartmentForm,
  apartmentForm: state.apartments.apartmentForm,
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
