import React from 'react';
import { connect } from 'react-redux';
import { IAppState } from '../redux/store/types';
import { IApartment } from '../redux/apartments/types';
import { IApartmentActivity, INewApartmentActivity } from '../redux/apartmentActivity/types';
import { timeShortDisplay, getApartment } from '../utils/utils';
import { setWSConnectedAction } from 'redux/websockets/actions';
import {
  prepareCreateApartmentActivityCommandAction,
  addApartmentActivityAction,
  prepareDeleteApartmentActivityCommandAction,
  deleteApartmentActivityAction,
} from '../redux/apartmentActivity/actions';
import { Save, Trash2, Undo2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { UserType } from 'redux/auth/types';

// Type-safe field names for IApartmentActivity
type ActivityField = keyof Pick<IApartmentActivity, 'description' | 'pending_confirmation'>;

/**
 * Component for managing and displaying apartment activity.
 * @class ApartmentActivity
 * @extends React.Component<IApartmentActivityProps, { emptyActivity: IApartmentActivity }>
 */
class ApartmentActivity extends React.Component<IApartmentActivityProps, { emptyActivity: INewApartmentActivity }> {
  private newActivityAmountRef = React.createRef<HTMLTextAreaElement>();

  /**
   * Creates an initial activity with default values
   * @returns {IApartmentActivity} A new activity with default values
   */
  private createInitialActivity = (): INewApartmentActivity => ({
    activity_id: uuidv4(),
    apartment_id: this.props.currentApartment?.apartment_id || '',
    description: '',
    pending_confirmation: false,
  });

  constructor(props: IApartmentActivityProps) {
    super(props);
    this.state = { emptyActivity: this.createInitialActivity() };
  }

  componentDidMount(): void {
    if (this.newActivityAmountRef.current) {
      this.newActivityAmountRef.current.focus();
    }
  }

  /**
   * Updates component when props change
   * @param {IApartmentActivityProps} prevProps - Previous component props
   */
  componentDidUpdate(prevProps: IApartmentActivityProps) {
    // Update emptyActivity's apartment_id when currentApartment changes
    if (
      this.props.currentApartment &&
      prevProps.currentApartment?.apartment_id !== this.props.currentApartment.apartment_id &&
      !this.props.currentApartment.is_disabled
    ) {
      this.setState((prevState) => ({
        emptyActivity: {
          ...prevState.emptyActivity,
          apartment_id: this.props.currentApartment?.apartment_id || '',
        },
      }));
    }

    // Focus the textarea when the component updates
    if (this.newActivityAmountRef.current) {
      this.newActivityAmountRef.current.focus();
    }
  }

  render() {
    const { activity } = this.props;

    return (
      <div className='page body-container'>
        <div className='header'>Apartment Activity</div>
        <div className='activity-container'>
          {activity.length > 0 && (
            <div className='table-header activity'>
              <div className='saved-at'>Saved At</div>
              <div className='description'>Description</div>
              <div className='pending-confirmation'>Wait for confirmation</div>
            </div>
          )}

          <div className='data-container activity-list'>
            {this.props.currentApartment && !this.props.currentApartment.is_disabled && (
              <div className='table-row activity input'>{this.renderActivity(this.state.emptyActivity)}</div>
            )}

            {activity.length > 0 ? (
              activity.map((activity, index) => (
                <div key={activity.activity_id} tabIndex={index} className={`table-row activity${activity.onroute ? ' onroute' : ''}`}>
                  {this.renderActivity(activity)}
                </div>
              ))
            ) : (
              <div className='empty-message'>No activity made ...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Validates a activity before execution
   * @param {IApartmentActivity} activity - ApartmentActivity to validate
   * @returns {boolean} Whether the activity is valid
   */
  isActivityValid = (activity: INewApartmentActivity) => {
    if (!activity.description) return false;
    return true;
  };

  /**
   * Updates a specific field in the empty activity state
   * @param {ActivityField} field - Field to update
   * @param {string | number | boolean} value - New value for the field
   */
  handleEmptyActivityChange = (field: ActivityField, value: string | number | boolean) => {
    this.setState((prevState) => ({
      emptyActivity: {
        ...prevState.emptyActivity,
        [field]: value,
      },
    }));
  };

  /**
   * Saves a activity and resets the form
   * @param {IApartmentActivity} activity - ApartmentActivity to save
   */
  handleSaveActivity = (activity: INewApartmentActivity) => {
    this.props.addApartmentActivityAction({ ...activity, created_at: new Date().toISOString(), onroute: true });
    this.props.prepareCreateApartmentActivityCommandAction(activity);
    this.setState({ emptyActivity: this.createInitialActivity() });
  };

  handleDeleteActivity = (activity_id: string, activity_description: string) => {
    if (window.confirm(`Are you sure you want to delete activity '${activity_description}'?`)) {
      this.props.prepareDeleteApartmentActivityCommandAction(activity_id);
      this.props.deleteApartmentActivityAction(activity_id);
    }
  };

  /**
   * Cancels the current activity and resets the form
   */
  handleCancelActivity = () => {
    this.setState({ emptyActivity: this.createInitialActivity() });
  };

  /**
   * Renders a single activity row
   * @param {Partial<IApartmentActivity>} activity - ApartmentActivity to render
   * @returns {JSX.Element} The rendered activity row
   */
  renderActivity = (activity: Partial<IApartmentActivity>) => {
    const isSaved = !!activity.created_at;
    const isValid = !isSaved ? this.isActivityValid(activity as INewApartmentActivity) : true;

    return (
      <>
        <div className='saved-at'>{isSaved ? timeShortDisplay(new Date(activity.created_at!)) : ''}</div>
        <div className='description'>
          {isSaved ? (
            activity.description
          ) : (
            <textarea
              ref={this.newActivityAmountRef}
              rows={2}
              value={activity.description || ''}
              onChange={(e) => {
                if (!isSaved) this.handleEmptyActivityChange('description' as ActivityField, e.target.value);
              }}
              readOnly={isSaved}
            />
          )}
        </div>
        <div className='pending-confirmation'>
          {isSaved ? (
            activity.pending_confirmation ? (
              'Waiting'
            ) : (
              ''
            )
          ) : (
            <input
              type='checkbox'
              checked={!!activity.pending_confirmation}
              onChange={(e) => {
                if (!isSaved) this.handleEmptyActivityChange('pending_confirmation' as ActivityField, e.target.checked);
              }}
            />
          )}
        </div>
        {!isSaved ? (
          <div className='actions'>
            <button onClick={() => this.handleSaveActivity(activity as INewApartmentActivity)} className='action-button save' title='Save' disabled={!isValid}>
              <Save />
            </button>
            <button onClick={() => this.handleCancelActivity()} className='action-button cancel' title='Cancel'>
              <Undo2 />
            </button>
          </div>
        ) : (
          this.props.userType === UserType.Admin && (
            <div className='actions'>
              <button
                onClick={() => this.handleDeleteActivity(activity.activity_id as string, activity.description as string)}
                className='action-button delete'
                title='Delete'>
                <Trash2 />
              </button>
            </div>
          )
        )}
      </>
    );
  };

  /**
   * Gets apartment details from either activity apartments or all apartments
   * @param {string} apartment_id - ID of apartment to get details for
   * @returns {IApartment | undefined} The apartment details if found
   */
  getApartmentDetails = (apartment_id: string) => {
    const { apartments } = this.props;
    return getApartment(apartments, apartment_id);
  };
}

/**
 * Props interface for ApartmentActivity component
 * @interface IApartmentActivityProps
 */
interface IApartmentActivityProps {
  userType: UserType;
  activity: IApartmentActivity[]; // List of activity activity
  apartments: IApartment[]; // List of all apartments
  currentApartment: IApartment | undefined; // Currently selected apartment
  setWSConnectedAction: typeof setWSConnectedAction; // Action to set WebSocket connection status
  prepareCreateApartmentActivityCommandAction: typeof prepareCreateApartmentActivityCommandAction; // Action to prepare a new activity
  addApartmentActivityAction: typeof addApartmentActivityAction; // Action to add a new activity
  prepareDeleteApartmentActivityCommandAction: typeof prepareDeleteApartmentActivityCommandAction; // Action to prepare a delete activity command
  deleteApartmentActivityAction: typeof deleteApartmentActivityAction; // Action to delete a activity
}

/**
 * Maps Redux state to component props
 * @param {IAppState} state - Current Redux state
 * @returns {Partial<IApartmentActivityProps>} Props derived from state
 */
const mapStateToProps = (state: IAppState) => ({
  userType: state.auth.userType,
  activity: state.apartmentActivity.activity,
  apartments: state.apartments.apartments,
  currentApartment: state.apartments.currentApartmentId
    ? state.apartments.apartments.find((acc) => acc.apartment_id === state.apartments.currentApartmentId)
    : undefined,
});

// Map Redux actions to component props
const mapDispatchToProps = {
  setWSConnectedAction,
  prepareCreateApartmentActivityCommandAction,
  addApartmentActivityAction,
  prepareDeleteApartmentActivityCommandAction,
  deleteApartmentActivityAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(ApartmentActivity);
