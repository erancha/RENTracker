import React from 'react';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { Save, Undo2 } from 'lucide-react';
import { IAppState } from '../redux/store/types';
import {
  updateApartmentFieldAction,
  setApartmentFormErrorsAction,
  resetApartmentFormAction,
  prepareCreateApartmentCommandAction,
  prepareUpdateApartmentCommandAction,
  addApartmentAction,
  setCurrentApartmentAction,
  setApartmentStateAction,
  toggleApartmentFormAction,
} from '../redux/apartments/actions';
import { bindActionCreators, Dispatch } from 'redux';
import initialState from '../redux/store/initialState';
import { v4 as uuidv4 } from 'uuid';

/**
 * A form component for creating and editing apartments.
 * Handles both creation of new apartments and modification of existing ones,
 * including the ability to enable/disable apartments in edit mode.
 */
class ApartmentFormBase extends React.Component<IApartmentFormProps> {
  private initialFormValues: typeof initialState.apartments.apartmentForm;

  constructor(props: IApartmentFormProps) {
    super(props);
    this.initialFormValues = props.formData.id ? { ...props.formData } : initialState.apartments.apartmentForm;
  }
  /**
   * Renders the form component.
   *
   * @returns The JSX element representing the form
   */
  render() {
    const { t, formData } = this.props;
    const mode = formData.id ? 'edit' : 'create';
    const { address, is_housing_unit, unit_number, rooms_count, rent_amount, is_disabled, errors } = formData;
    const isEditMode = mode === 'edit';

    return (
      <div className={`table-row apartment input${(mode === 'edit' && ' update') || ''}`}>
        <div className='address required input-and-error-container' data-title={t('common.fields.address')}>
          <input
            autoFocus
            type='text'
            value={address}
            onChange={(e) => this.props.updateApartmentFieldAction('address', e.target.value)}
            onBlur={() => {
              const errors = this.validateForm(this.props.formData, 'address');
              if (Object.keys(errors).length > 0) {
                this.props.setApartmentFormErrorsAction({ ...this.props.formData.errors, ...errors });
              }
            }}
            className={`address ${errors.address ? 'error-message' : ''}`}
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
                onChange={(e) => this.props.updateApartmentFieldAction('is_housing_unit', e.target.checked)}
              />
            </label>
          </div>

          <div className='unit-number required input-and-error-container' data-title={t('apartments.fields.unitNumber')}>
            <input
              type='text'
              value={unit_number}
              onChange={(e) => this.props.updateApartmentFieldAction('unit_number', e.target.value)}
              onBlur={() => {
                const errors = this.validateForm(this.props.formData, 'unit_number');
                if (Object.keys(errors).length > 0) {
                  this.props.setApartmentFormErrorsAction({ ...this.props.formData.errors, ...errors });
                }
              }}
              className={`unit-number ${errors.unit_number ? 'error-message' : ''}`}
            />
            {errors.unit_number && <span className='error-message'>{errors.unit_number}</span>}
          </div>
        </div>

        <div className='rooms-count required input-and-error-container' data-title={t('common.roomCount')}>
          <input
            type='number'
            value={rooms_count || ''}
            onChange={(e) => this.props.updateApartmentFieldAction('rooms_count', Number(e.target.value))}
            onBlur={() => {
              const errors = this.validateForm(this.props.formData, 'rooms_count');
              if (Object.keys(errors).length > 0) {
                this.props.setApartmentFormErrorsAction({ ...this.props.formData.errors, ...errors });
              }
            }}
            className={errors.rooms_count ? 'error-message' : ''}
            min={ROOMS_COUNT.MIN}
            max={ROOMS_COUNT.MAX}
            step={ROOMS_COUNT.STEP}
          />
          {errors.rooms_count && <span className='error-message'>{errors.rooms_count}</span>}
        </div>

        <div className='rent-amount required input-and-error-container' data-title={t('apartments.fields.rentAmount')}>
          <input
            type='number'
            value={rent_amount || ''}
            onChange={(e) => this.props.updateApartmentFieldAction('rent_amount', Number(e.target.value))}
            onBlur={() => {
              const errors = this.validateForm(this.props.formData, 'rent_amount');
              if (Object.keys(errors).length > 0) {
                this.props.setApartmentFormErrorsAction({ ...this.props.formData.errors, ...errors });
              }
            }}
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
                onChange={(e) => this.props.updateApartmentFieldAction('is_disabled', e.target.checked)}
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
    const { formData } = this.props;
    const mode = formData.id ? 'edit' : 'create';
    const values = {
      address: formData.address,
      is_housing_unit: formData.is_housing_unit,
      unit_number: formData.unit_number,
      rooms_count: formData.rooms_count,
      rent_amount: formData.rent_amount,
      is_disabled: formData.is_disabled,
    };

    const errors = this.validateForm(values);

    if (Object.keys(errors).length === 0) {
      if (mode === 'create') {
        const apartment_id = uuidv4();
        this.props.prepareCreateApartmentCommandAction(
          apartment_id,
          values.address,
          values.is_housing_unit,
          values.unit_number,
          values.rooms_count,
          values.rent_amount
        );
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
      } else {
        // Update local state first (in redux)
        this.props.setApartmentStateAction({
          ...values,
          apartment_id: formData.id,
          onroute: true,
          is_disabled: values.is_disabled ?? false,
        });

        // Send update command (to the backend)
        this.props.prepareUpdateApartmentCommandAction(formData.id, {
          ...values,
          is_disabled: values.is_disabled ?? false,
        });

        // Reset form state
        this.props.toggleApartmentFormAction(false);
        this.props.resetApartmentFormAction();
      }
    } else {
      this.props.setApartmentFormErrorsAction(errors);
    }
  };

  /**
   * Handles the cancel action with confirmation if there are unsaved changes
   */
  handleCancel = () => {
    if (this.hasUnsavedChanges()) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.props.toggleApartmentFormAction(false);
        this.props.resetApartmentFormAction();
      }
    } else {
      this.props.toggleApartmentFormAction(false);
      this.props.resetApartmentFormAction();
    }
  };

  /**
   * Checks if the form has any unsaved changes by comparing current state with initial values
   */
  hasUnsavedChanges = (): boolean => {
    const { formData } = this.props;

    return (
      formData.address !== this.initialFormValues.address ||
      formData.is_housing_unit !== this.initialFormValues.is_housing_unit ||
      formData.unit_number !== this.initialFormValues.unit_number ||
      formData.rooms_count !== this.initialFormValues.rooms_count ||
      formData.rent_amount !== this.initialFormValues.rent_amount ||
      formData.is_disabled !== this.initialFormValues.is_disabled
    );
  };
  /**
   * Validates apartment form fields
   * @param {object} values - Form values to validate
   * @returns {Record<string, string>} Validation errors if any
   */
  validateForm = (values: { address: string; unit_number: string; rooms_count: number; rent_amount: number }, fieldToValidate?: keyof typeof values) => {
    const { t } = this.props;
    const errors: Record<string, string> = {};

    const validateSingleField = (field: keyof typeof values) => {
      switch (field) {
        case 'address':
          if (!values.address) errors.address = t('validation.required');
          else if (values.address.length < 5) errors.address = t('validation.valueTooShort');
          break;

        case 'unit_number':
          if (!values.unit_number) errors.unit_number = t('validation.required');
          else if (values.unit_number.length > 4) errors.unit_number = t('validation.valueTooLong');
          break;

        case 'rooms_count':
          if (!values.rooms_count) errors.rooms_count = t('validation.required');
          else if (values.rooms_count < ROOMS_COUNT.MIN || values.rooms_count > ROOMS_COUNT.MAX || values.rooms_count % ROOMS_COUNT.STEP !== 0)
            errors.rooms_count = t('validation.roomsCount');
          break;

        case 'rent_amount':
          if (!values.rent_amount || values.rent_amount <= 0) errors.rent_amount = t('validation.required');
          break;
      }
    };

    if (fieldToValidate) {
      validateSingleField(fieldToValidate);
    } else {
      validateSingleField('address');
      validateSingleField('unit_number');
      validateSingleField('rooms_count');
      validateSingleField('rent_amount');
    }

    return errors;
  };
}

const ROOMS_COUNT = {
  MIN: 1,
  MAX: 20,
  STEP: 0.5,
} as const;

interface IApartmentFormProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  tReady: boolean;

  formData: {
    id: string;
    address: string;
    is_housing_unit: boolean;
    unit_number: string;
    rooms_count: number;
    rent_amount: number;
    is_disabled: boolean;
    errors: Record<string, string>;
  };
  userId: string | null;

  updateApartmentFieldAction: (field: string, value: string | number | boolean) => void;
  setApartmentFormErrorsAction: (errors: Record<string, string>) => void;
  resetApartmentFormAction: () => void;
  prepareCreateApartmentCommandAction: (
    apartment_id: string,
    address: string,
    is_housing_unit: boolean,
    unit_number: string,
    rooms_count: number,
    rent_amount: number
  ) => void;
  prepareUpdateApartmentCommandAction: (apartment_id: string, values: any) => void;
  addApartmentAction: (apartment: any) => void;
  setCurrentApartmentAction: (apartment_id: string) => void;

  setApartmentStateAction: (apartment: any) => void;
  toggleApartmentFormAction: (show: boolean) => void;
}

const mapStateToProps = (state: IAppState) => ({
  formData: state.apartments.apartmentForm,
  userId: state.auth.userId,
});

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      updateApartmentFieldAction,
      setApartmentFormErrorsAction,
      resetApartmentFormAction,
      prepareCreateApartmentCommandAction,
      prepareUpdateApartmentCommandAction,
      addApartmentAction,
      setCurrentApartmentAction,

      setApartmentStateAction,
      toggleApartmentFormAction,
    },
    dispatch
  );

export const ApartmentForm = connect(mapStateToProps, mapDispatchToProps)(withTranslation()(ApartmentFormBase));
