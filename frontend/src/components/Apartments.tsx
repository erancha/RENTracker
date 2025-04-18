import React from 'react';
import { connect } from 'react-redux';
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
import { Trash2, Pencil, FileText, Copy, Plus } from 'lucide-react';
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
    const { userType, showApartmentForm, toggleApartmentFormAction, resetApartmentFormAction, isWsConnected, currentApartmentId, apartmentForm } = this.props;
    const { showDocuments } = this.state;
    const filteredApartments = this.getFilteredApartments();

    return (
      <div className='body-container'>
        <div className={`page apartments-container${!isWsConnected ? ' disconnected' : ''}`}>
          <div className='header'>
            Apartments
            <button onClick={() => toggleApartmentFormAction(!showApartmentForm)} className='action-button add'>
              {!showApartmentForm && <Plus />}
            </button>
          </div>
          <div className='data-container cards-list apartments-list'>
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
                  className={`card apartment${apartment.onroute ? ' onroute' : ''}${!apartment.is_disabled ? ' open' : ' closed'}${
                    userType === UserType.Landlord ? ' isLandlord' : ''
                  }${apartment.apartment_id === currentApartmentId ? ' current' : ''}`}
                  onClick={() => this.handleApartmentClick(apartment.apartment_id)}
                  ref={apartment.apartment_id === currentApartmentId ? this.currentApartmentRef : undefined}>
                  <div className='apartment-id' title='apartment-id'>
                    {apartment.apartment_id}
                  </div>
                  {/* <p>{apartment.user_name}</p> */}
                  <div className='details'>
                    {apartment.updated_at && (
                      <div className='updated-at' data-title='Updated At'>
                        {new Date(apartment.updated_at).toLocaleDateString()}
                      </div>
                    )}
                    <div className='address' data-title='Address'>
                      {apartment.address} {apartment.unit_number && `(${apartment.unit_number})`}
                    </div>
                    <div className='rooms-count' data-title='Rooms Count'>
                      {apartment.rooms_count}
                    </div>
                    <div className='rent-amount' data-title='Rent Amount'>
                      {apartment.rent_amount.toLocaleString()}₪
                    </div>
                    {[UserType.Landlord, UserType.Admin].includes(userType) && (
                      <div className='actions'>
                        <button onClick={() => this.handleEditApartment(apartment)} className='action-button' title='Edit'>
                          <Pencil />
                        </button>
                        <button className='action-button' title='Duplicate' onClick={() => this.handleDuplicateApartment(apartment)}>
                          <Copy />
                        </button>
                        <button onClick={() => this.handleDeleteApartment(apartment)} className='action-button delete' title='Delete'>
                          <Trash2 />
                        </button>
                        {this.renderDocumentsToggleButton()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className='empty-message'>No apartments found. Create a new apartment ...</div>
            )}
          </div>
        </div>

        {!showApartmentForm && filteredApartments.length > 0 && (
          <>
            {showDocuments ? (
              <div className='documents-container'>{currentApartmentId && <ApartmentDocumentList key={currentApartmentId} />}</div>
            ) : (
              <ApartmentActivity />
            )}
          </>
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
  renderDocumentsToggleButton = () => (
    <button
      onClick={this.handleShowDocuments}
      className='action-button documents activity'
      title={this.state.showDocuments ? 'Show ApartmentActivity' : 'Show Rental Agreements'}>
      <FileText />
    </button>
  );

  /**
   * Toggles between documents and activity view
   */
  handleShowDocuments = () => {
    this.setState((prevState) => ({ showDocuments: !prevState.showDocuments }));
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

    if (!values.address) errors.address = 'Address is required.';
    if (!values.rooms_count || values.rooms_count <= 0 || values.rooms_count > 20 || values.rooms_count % 0.5 !== 0)
      errors.rooms_count = 'Valid rooms count is required (in increments of 0.5).';
    if (!values.rent_amount || values.rent_amount <= 0) errors.rent_amount = 'Valid rent amount is required.';

    return errors;
  };

  /**
   * Handles apartment selection and loads its activity
   * @param {string} apartment_id - ID of the selected apartment
   */
  handleApartmentClick = (apartment_id: string) => {
    // Only proceed if the apartment_id is different from current
    if (apartment_id !== this.props.currentApartmentId) {
      this.props.setCurrentApartmentAction(apartment_id);
      this.props.clearApartmentActivityAction();
      this.props.prepareReadApartmentActivityCommandAction(apartment_id);
    }
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
    if (window.confirm(`Are you sure you want to delete this ${!apartment.is_disabled ? 'open ' : ''}apartment?`)) {
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

export default connect(mapStateToProps, mapDispatchToProps)(Apartments);
