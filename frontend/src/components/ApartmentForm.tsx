import React from 'react';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { Save, Undo2 } from 'lucide-react';

/**
 * A form component for creating and editing apartments.
 * Handles both creation of new apartments and modification of existing ones,
 * including the ability to enable/disable apartments in edit mode.
 */
class ApartmentFormBase extends React.Component<IApartmentFormProps, IApartmentFormState> {
  /**
   * Initializes the component's state with the provided initial values.
   *
   * @param props The component's props
   */
  constructor(props: IApartmentFormProps) {
    super(props);
    this.state = {
      address: props.initialValues.address || '',
      is_housing_unit: props.initialValues.is_housing_unit || false,
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
    const { mode, errors, inputRef, t } = this.props;
    const { address, is_housing_unit, unit_number, rooms_count, rent_amount, is_disabled } = this.state;
    const isEditMode = mode === 'edit';

    return (
      <div className={`table-row apartment input${(mode === 'edit' && ' update') || ''}`}>
        <div className='address required input-and-error-container' data-title={t('common.fields.address')}>
          <input
            type='text'
            value={address}
            onChange={(e) => this.setState({ address: e.target.value })}
            className={`address ${errors.address ? 'error-message' : ''}`}
            ref={inputRef}
          />
          {errors.address && <span className='error-message'>{errors.address}</span>}
        </div>

        <div className='apartment-housing-unit-container'>
          <div className='is-housing-unit' data-title={t('apartments.fields.housingUnit')}>
            <label>
              <input
                type='checkbox'
                title={t('apartments.fields.housingUnit')}
                checked={is_housing_unit}
                onChange={(e) => this.setState({ is_housing_unit: e.target.checked })}
              />
            </label>
          </div>

          <div className='unit-number input-and-error-container' data-title={t('apartments.fields.unitNumber')}>
            <input
              type='text'
              value={unit_number}
              onChange={(e) => this.setState({ unit_number: e.target.value })}
              className={`unit ${errors.unit_number ? 'error-message' : ''}`}
            />
            {errors.unit_number && <span className='error-message'>{errors.unit_number}</span>}
          </div>
        </div>

        <div className='rooms-count required input-and-error-container' data-title={t('common.roomCount')}>
          <input
            type='number'
            value={rooms_count || ''}
            onChange={(e) => this.setState({ rooms_count: Number(e.target.value) })}
            className={errors.rooms_count ? 'error-message' : ''}
            step='0.5'
          />
          {errors.rooms_count && <span className='error-message'>{errors.rooms_count}</span>}
        </div>

        <div className='rent-amount required input-and-error-container' data-title={t('apartments.fields.rentAmount')}>
          <input
            type='number'
            value={rent_amount || ''}
            onChange={(e) => this.setState({ rent_amount: Number(e.target.value) })}
            className={`rent-amount ${errors.rent_amount ? 'error-message' : ''}`}
            step='50'
          />
          {errors.rent_amount && <span className='error-message'>{errors.rent_amount}</span>}
        </div>

        {isEditMode && (
          <div className='disabled-toggle' data-title={t('apartments.fields.disable')}>
            <label>
              <input
                type='checkbox'
                title={t('apartments.fields.disable')}
                checked={is_disabled}
                onChange={(e) => this.setState({ is_disabled: e.target.checked })}
              />
            </label>
          </div>
        )}

        <div className='actions'>
          <button onClick={this.handleSubmit} className='action-button save' title={t(`apartments.tooltips.save${mode === 'create' ? 'New' : 'Modified'}`)}>
            <Save />
          </button>
          <button onClick={this.handleCancel} className='action-button cancel' title={t('common.cancel')}>
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
      is_housing_unit: this.state.is_housing_unit,
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
      this.state.is_housing_unit !== (initialValues.is_housing_unit || false) ||
      this.state.unit_number !== (initialValues.unit_number || '') ||
      this.state.rooms_count !== (initialValues.rooms_count || 0) ||
      this.state.rent_amount !== (initialValues.rent_amount || 0) ||
      this.state.is_disabled !== (initialValues.is_disabled || false)
    );
  };
}

interface IApartmentFormValues {
  address: string;
  is_housing_unit: boolean;
  unit_number: string;
  rooms_count: number;
  rent_amount: number;
  is_disabled?: boolean;
}

interface IApartmentFormProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  tReady: boolean;
  mode: 'create' | 'edit';
  initialValues: IApartmentFormValues;
  errors: Record<string, string>;
  onSubmit: (values: IApartmentFormValues) => void;
  onCancel: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

interface IApartmentFormState {
  address: string;
  is_housing_unit: boolean;
  unit_number: string;
  rooms_count: number;
  rent_amount: number;
  is_disabled: boolean;
}

export const ApartmentForm = withTranslation()(ApartmentFormBase);
