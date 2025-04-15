import React from 'react';
import { Save, Undo2 } from 'lucide-react';

interface IApartmentFormProps {
  mode: 'create' | 'update';
  initialValues: {
    address: string;
    unit_number: string;
    rooms_count: number;
    rent_amount: number;
    is_disabled?: boolean;
  };
  errors: Record<string, string>;
  onSubmit: (values: { address: string; unit_number: string; rooms_count: number; rent_amount: number; is_disabled?: boolean }) => void;
  onCancel: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

interface IApartmentFormState {
  address: string;
  unit_number: string;
  rooms_count: number;
  rent_amount: number;
  is_disabled: boolean;
}

/**
 * A form component for creating and editing apartments.
 * Handles both creation of new apartments and modification of existing ones,
 * including the ability to enable/disable apartments in edit mode.
 */
export class ApartmentForm extends React.Component<IApartmentFormProps, IApartmentFormState> {
  /**
   * Initializes the component's state with the provided initial values.
   *
   * @param props The component's props
   */
  constructor(props: IApartmentFormProps) {
    super(props);
    this.state = {
      address: props.initialValues.address || '',
      unit_number: props.initialValues.unit_number || '',
      rooms_count: props.initialValues.rooms_count || 0,
      rent_amount: props.initialValues.rent_amount || 0,
      is_disabled: props.initialValues.is_disabled || false,
    };
  }

  /**
   * Renders the form component.
   *
   * @returns The JSX element representing the form
   */
  render() {
    const { mode, errors, inputRef } = this.props;
    const { address, unit_number, rooms_count, rent_amount, is_disabled } = this.state;

    return (
      <div className='card apartment input'>
        <div className='address input-and-error-container' data-title='Address'>
          <input
            type='text'
            title='Address'
            value={address}
            onChange={(e) => this.setState({ address: e.target.value })}
            placeholder='Building address...'
            className={`address ${errors.address ? 'error-message' : ''}`}
            ref={inputRef}
          />
          {errors.address && <span className='error-message'>{errors.address}</span>}
        </div>

        <div className='unit-number input-and-error-container' data-title='Unit Number'>
          <input
            type='text'
            title='Unit Number'
            value={unit_number}
            onChange={(e) => this.setState({ unit_number: e.target.value })}
            placeholder='Unit number (e.g. Apt 2B)...'
            className={`unit ${errors.unit_number ? 'error-message' : ''}`}
          />
          {errors.unit_number && <span className='error-message'>{errors.unit_number}</span>}
        </div>

        <div className='rooms-count input-and-error-container' data-title='Rooms Count'>
          <input
            type='number'
            title='Rooms Count'
            value={rooms_count || ''}
            onChange={(e) => this.setState({ rooms_count: Number(e.target.value) })}
            placeholder='Number of rooms...'
            className={`rooms ${errors.rooms_count ? 'error-message' : ''}`}
            step='0.5'
          />
          {errors.rooms_count && <span className='error-message'>{errors.rooms_count}</span>}
        </div>

        <div className='rent-amount input-and-error-container' data-title='Rent Amount'>
          <input
            type='number'
            title='Rent Amount'
            value={rent_amount || ''}
            onChange={(e) => this.setState({ rent_amount: Number(e.target.value) })}
            placeholder='Monthly rent amount...'
            className={`rent ${errors.rent_amount ? 'error-message' : ''}`}
            step='50'
          />
          {errors.rent_amount && <span className='error-message'>{errors.rent_amount}</span>}
        </div>

        {mode === 'update' && (
          <div className='disabled-toggle' data-title='Disable'>
            <label>
              <input type='checkbox' title='Disable apartment' checked={is_disabled} onChange={(e) => this.setState({ is_disabled: e.target.checked })} />
            </label>
          </div>
        )}

        <div className='actions'>
          <button onClick={this.handleSubmit} className='action-button save' title={`Save the ${mode === 'create' ? 'new' : 'modified'} apartment`}>
            <Save />
          </button>
          <button onClick={this.handleCancel} className='action-button cancel' title='Cancel'>
            <Undo2 />
          </button>
        </div>
      </div>
    );
  }

  /**
   * Submits the current form values to the parent component
   */
  handleSubmit = () => {
    this.props.onSubmit({
      address: this.state.address,
      unit_number: this.state.unit_number,
      rooms_count: this.state.rooms_count,
      rent_amount: this.state.rent_amount,
      is_disabled: this.state.is_disabled,
    });
  };

  /**
   * Handles the cancel action with confirmation if there are unsaved changes
   */
  handleCancel = () => {
    if (this.hasUnsavedChanges()) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.props.onCancel();
      }
    } else {
      this.props.onCancel();
    }
  };

  /**
   * Checks if the form has any unsaved changes by comparing current state with initial values
   */
  hasUnsavedChanges = (): boolean => {
    const { initialValues } = this.props;
    return (
      this.state.address !== (initialValues.address || '') ||
      this.state.unit_number !== (initialValues.unit_number || '') ||
      this.state.rooms_count !== (initialValues.rooms_count || 0) ||
      this.state.rent_amount !== (initialValues.rent_amount || 0) ||
      this.state.is_disabled !== (initialValues.is_disabled || false)
    );
  };
}
