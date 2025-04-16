import React from 'react';
import { connect } from 'react-redux';
import { IAppState } from '../redux/store/types';
import { IApartment } from '../redux/apartments/types';
import { IActivity, INewActivity } from '../redux/activity/types';
import { timeShortDisplay, getApartment } from '../utils/utils';
import { setWSConnectedAction } from 'redux/websockets/actions';
import { prepareCreateActivityCommandAction, addActivityAction } from '../redux/activity/actions';
import { Save, Undo2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Type-safe field names for IActivity
type ActivityField = keyof Pick<IActivity, 'description' | 'pending_confirmation'>;

/**
 * Component for managing and displaying apartment activity.
 * @class Activity
 * @extends React.Component<IApartmentActivityProps, { emptyActivity: IActivity }>
 */
class Activity extends React.Component<IApartmentActivityProps, { emptyActivity: INewActivity }> {
  private newActivityAmountRef = React.createRef<HTMLInputElement>();

  /**
   * Creates an initial activity with default values
   * @returns {IActivity} A new activity with default values
   */
  private createInitialActivity = (): INewActivity => ({
    activity_id: uuidv4(),
    apartment_id: this.props.currentApartment?.apartment_id || '',
    description: '',
    pending_confirmation: false,
  });

  constructor(props: IApartmentActivityProps) {
    super(props);
    this.state = { emptyActivity: this.createInitialActivity() };
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

    // Focus when activity are loaded
    if (prevProps.activity.length === 0 && this.props.activity.length > 0) {
      setTimeout(() => {
        const inputElement = this.newActivityAmountRef.current;
        if (inputElement) {
          inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputElement.click();
        }
      }, 100);
    }
  }

  render() {
    const { activity } = this.props;

    return (
      <div className='page body-container'>
        <div className='header activity-container-header'>Activity</div>
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
   * @param {IActivity} activity - Activity to validate
   * @returns {boolean} Whether the activity is valid
   */
  isActivityValid = (activity: INewActivity) => {
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
   * @param {IActivity} activity - Activity to save
   */
  handleSaveActivity = (activity: INewActivity) => {
    this.props.addActivityAction({ ...activity, created_at: new Date().toISOString(), onroute: true });
    this.props.prepareCreateActivityCommandAction(activity);
    this.setState({ emptyActivity: this.createInitialActivity() });
  };

  /**
   * Cancels the current activity and resets the form
   */
  handleCancelActivity = () => {
    this.setState({ emptyActivity: this.createInitialActivity() });
  };

  /**
   * Renders a single activity row
   * @param {Partial<IActivity>} activity - Activity to render
   * @returns {JSX.Element} The rendered activity row
   */
  renderActivity = (activity: Partial<IActivity>) => {
    const isSaved = !!activity.created_at;
    const isValid = !isSaved ? this.isActivityValid(activity as INewActivity) : true;

    return (
      <>
        <div className='saved-at'>{isSaved ? timeShortDisplay(new Date(activity.created_at!)) : ''}</div>
        <div className='description'>
          {isSaved ? (
            activity.description
          ) : (
            <input
              ref={this.newActivityAmountRef}
              type='text'
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
              'Waiting ...'
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
        {!isSaved && (
          <div className='actions'>
            <button onClick={() => this.handleSaveActivity(activity as INewActivity)} className='action-button save' title='Save' disabled={!isValid}>
              <Save />
            </button>
            <button onClick={() => this.handleCancelActivity()} className='action-button cancel' title='Cancel'>
              <Undo2 />
            </button>
          </div>
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
 * Props interface for Activity component
 * @interface IApartmentActivityProps
 */
interface IApartmentActivityProps {
  activity: IActivity[]; // List of activity activity
  apartments: IApartment[]; // List of all apartments
  currentApartment: IApartment | undefined; // Currently selected apartment
  setWSConnectedAction: typeof setWSConnectedAction; // Action to set WebSocket connection status
  prepareCreateActivityCommandAction: typeof prepareCreateActivityCommandAction; // Action to prepare a new activity
  addActivityAction: typeof addActivityAction; // Action to add a new activity
}

/**
 * Maps Redux state to component props
 * @param {IAppState} state - Current Redux state
 * @returns {Partial<IApartmentActivityProps>} Props derived from state
 */
const mapStateToProps = (state: IAppState) => ({
  activity: state.activity.activity,
  apartments: state.apartments.apartments,
  currentApartment: state.apartments.currentApartmentId
    ? state.apartments.apartments.find((acc) => acc.apartment_id === state.apartments.currentApartmentId)
    : undefined,
});

// Map Redux actions to component props
const mapDispatchToProps = {
  setWSConnectedAction,
  prepareCreateActivityCommandAction,
  addActivityAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(Activity);
