/**
 * DocumentForm Component
 *
 * A comprehensive form component for creating and editing rental agreements with the following features:
 *
 * Key Features:
 * - Multi-section form with expandable/collapsible sections:
 *   - Property Details
 *   - Lease & Financial Terms
 *   - Utility Limits
 *   - Landlord Details
 *   - Tenant Details (supports up to 2 tenants)
 *   - Security Details
 *   - Guarantor Details
 *   - Signature
 *
 * Core Functionality:
 * - Form validation for required fields
 * - Date calculations and validations
 * - Israeli ID and phone number validations
 * - File upload handling
 * - Digital signature support
 * - Auto-population of fields based on user type
 * - State management for form data and errors
 * - Unsaved changes detection
 *
 * @class DocumentForm
 * @extends {React.Component<DocumentFormProps, DocumentFormState>}
 */

import React from 'react';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import {
  TextField,
  Typography,
  Paper,
  Grid,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ExpandMore } from '@mui/icons-material';
import { Save, Undo2, Plus } from 'lucide-react';
import { validateIsraeliPhone, formatPhoneNumber, validateIsraeliId } from 'utils/utils';
import { connect } from 'react-redux';
import { toast } from 'react-toastify';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { RootState } from '../redux/store/reducers';
import { IDocument } from '../redux/documents/types';
import { UserType, IAuthState } from '../redux/auth/types';
import { getDocumentTitle } from '../utils/documentUtils';
import { fieldToSection } from '../constants/documentFields';
import { getDocumentThunk, createDocumentThunk, updateDocumentThunk } from '../redux/documents/thunks';
import { actions as documentActions } from '../redux/documents/slice';
import he from 'date-fns/locale/he';
import { IncludedEquipmentSelect } from './IncludedEquipmentSelect';
import { uploadFile, uploadContent } from '../services/rest';
import ImagesViewer from './ImagesViewer';
import SignatureMaker from './SignatureMaker';
import { ISaasTenant } from 'redux/saasTenants/types';

/**
 * DocumentForm component for creating and editing rental agreements
 * Provides a multi-section form with validation for all required rental agreement fields
 * @class DocumentForm
 * @extends {React.Component<DocumentFormProps, DocumentFormState>}
 */
class DocumentForm extends React.Component<DocumentFormProps, DocumentFormState> {
  /**
   * Maps field names to their corresponding form sections
   * @private
   */
  private sectionMapping: Record<string, string> = fieldToSection;

  /**
   * Default values for all template fields
   * @private
   */
  private defaultTemplateFields: Record<string, any> = {
    date: new Date().toISOString().split('T')[0],
    landlordName: '',
    landlordId: '',
    landlordEmail: '',
    landlordAddress: '',
    landlordPhone: '',
    tenant1Name: '',
    tenant1Id: '',
    tenant1Phone: '',
    tenant1Email: '',
    tenant1Address: '',
    tenant1IdCard: '',
    tenant1Salary1: '',
    tenant1Salary2: '',
    propertyAddress: '',
    roomCount: '',
    leasePeriod: '12',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1, 12).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 13, 0, 12).toISOString().split('T')[0],
    rentAmount: '',
    paymentDay: '1',
    initialPaymentMonths: '',
    standingOrderStart: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1, 12).toISOString().split('T')[0],
    waterLimit: '150',
    electricityLimit: '250',
    includedServices: 'יס וקו אינטרנט',
    includedEquipment: 'מקרר, ספה ושולחן ,מכונת כביסה, מייבש, טלוויזיה, מזגן, מיטה, מזרון, ארון',
    securityRequired: false,
    securityDeposit: '',
    guarantorRequired: false,
    guarantorName: '',
    guarantorId: '',
    guarantorPhone: '',
    guarantorAddress: '',
  };

  // Fields that must have a value based on rental agreement template
  private requiredFields = [
    'date',
    'landlordName',
    'landlordId',
    'landlordPhone',
    'landlordEmail',
    'landlordAddress',
    // Tenant fields are only required for tenants
    ...(this.props.userType === UserType.Tenant
      ? ['tenant1Name', 'tenant1Id', 'tenant1Phone', 'tenant1Email', 'tenant1IdCard', 'tenant1Salary1', 'tenant1Salary2']
      : ['tenant1Name']),
    'roomCount',
    'propertyAddress',
    'includedEquipment',
    'includedServices',
    'leasePeriod',
    'startDate',
    'endDate',
    'rentAmount',
    'paymentDay',
    'initialPaymentMonths',
    'standingOrderStart',
    'waterLimit',
    'electricityLimit',
  ];

  constructor(props: DocumentFormProps) {
    super(props);

    // Initialize default fields with apartment-specific values if available
    this.defaultTemplateFields = {
      ...this.defaultTemplateFields,
      ...(props.apartmentInitiatedFields && {
        propertyAddress: props.apartmentInitiatedFields.propertyAddress,
        roomCount: props.apartmentInitiatedFields.roomCount,
        rentAmount: props.apartmentInitiatedFields.rentAmount,
      }),
    };

    // Start with either selected document fields or initial fields
    let templateFields = props.selectedDocument?.template_fields || props.initialTemplateFields || this.defaultTemplateFields;

    // Create a new object to avoid mutating the source and populate user name and emails
    templateFields = this.populateCurrentUserFields(templateFields, props.userType, props.auth.email as string);

    // Initialize state
    this.state = {
      expandedSections: [],
      formData: templateFields,
      errors: {},
      initialFormData: templateFields, // Store the initial populated fields
      showImagesViewer: false,
      showSecondTenant: !!templateFields.tenant2Name,
      expandSecondTenant: false,
    };
  }

  /**
   * Lifecycle method to initialize form data
   * Fetches document data if in edit mode or sets up new document if in create mode
   */
  componentDidMount() {
    const { documentId, selectedDocument, initialTemplateFields } = this.props;

    if (initialTemplateFields) this.updateFormState(initialTemplateFields); // Duplicate mode:
    else if (documentId && selectedDocument) this.updateFormState(selectedDocument.template_fields); // Edit mode:
    else if (!documentId) this.updateFormState(this.defaultTemplateFields); // Create mode
  }

  /**
   * Update form when selected document is loaded
   */
  componentDidUpdate(prevProps: DocumentFormProps) {
    const { selectedDocument } = this.props;

    if (
      // If we just received the document data
      selectedDocument &&
      (!prevProps.selectedDocument || prevProps.selectedDocument.document_id !== selectedDocument.document_id)
    ) {
      this.updateFormState(selectedDocument.template_fields);
    }
  }

  /**
   * Updates the form state by populating user fields and determining which sections should be expanded.
   * Used in both initial mount and subsequent document updates.
   * @private
   * @param templateFields - The template fields to populate and update state with
   */
  private updateFormState = (templateFields: Record<string, any>) => {
    const { userType, auth } = this.props;
    templateFields = this.populateCurrentUserFields(templateFields, userType, auth.email as string);
    this.setState((prevState) => ({
      formData: templateFields,
      expandedSections: this.decideExpandedSections(prevState.expandedSections, templateFields, userType),
    }));
  };

  /**
   * Populates a few fields based on user type, from the current user and from the SaaSTenants saved details.
   * @private
   */
  private populateCurrentUserFields = (templateFields: Record<string, any>, currentUserType: UserType, currentUserEmail: string): Record<string, any> => {
    const retTemplateFields = { ...templateFields };

    if (currentUserType === UserType.Landlord) {
      if (!retTemplateFields.landlordEmail) retTemplateFields.landlordEmail = currentUserEmail;

      const saasTenant = this.props.saasTenants[0];
      if (!retTemplateFields.landlordName) retTemplateFields.landlordName = saasTenant.name;
      if (!retTemplateFields.landlordId) retTemplateFields.landlordId = saasTenant.israeli_id;
      if (!retTemplateFields.landlordPhone) retTemplateFields.landlordPhone = saasTenant.phone;
      if (!retTemplateFields.landlordAddress) retTemplateFields.landlordAddress = saasTenant.address;
    } else if (currentUserType === UserType.Tenant) {
      if (!retTemplateFields.tenant1Email) retTemplateFields.tenant1Email = currentUserEmail;
    }

    return retTemplateFields;
  };

  private decideExpandedSections = (prevExpandedSections: string[], templateFields: Record<string, any>, userType: UserType): string[] => {
    let retExpandedSections: string[] = [...prevExpandedSections];

    if (userType === UserType.Landlord) {
      if (!templateFields.initialPaymentMonths) retExpandedSections.push('leaseTerms');
      else if (!templateFields.tenant1Name) retExpandedSections.push('tenant1Details');
      else if (!!templateFields.tenantSignature && !templateFields.landlordSignature) retExpandedSections.push('signature');
    } else {
      if (!templateFields.tenant1Phone) retExpandedSections.push('tenant1Details', 'tenant1Attachments');
      else if (!!templateFields.tenant1IdCard && !!templateFields.tenant1Salary1 && !!templateFields.tenant1Salary2 && !templateFields.tenantSignature)
        retExpandedSections.push('signature');
    }

    // console.log({ templateFields, retExpandedSections });
    return retExpandedSections;
  };

  private isSectionExpanded = (sectionId: string): boolean => this.state.expandedSections.includes(sectionId);

  render() {
    const { t } = this.props;
    return (
      <Paper sx={{ p: 2 }}>
        <form onSubmit={this.handleSubmit} noValidate>
          <div className='header-container'>
            <Box sx={{ mb: 2 }}>
              <Typography variant='h5' gutterBottom>
                {getDocumentTitle(this.state.formData?.tenant1Name, t('documents.rentalAgreement'))}
              </Typography>
            </Box>
            {this.renderCancelButton()}
          </div>

          {/* Property Details */}
          <Accordion expanded={this.isSectionExpanded('propertyDetails')} onChange={this.handleAccordionChange('propertyDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.property')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={8} sm={5} md={4}>
                  {this.renderTextField('propertyAddress', t('documentForm.fields.propertyAddress'), { isDisabled: true })}
                </Grid>
                <Grid item xs={4} sm={3} md={1}>
                  {this.renderNumberField('roomCount', t('common.roomCount'), { min: 1, max: 20, step: '0.5', isDisabled: true })}
                </Grid>
                <Grid item xs={12}>
                  <IncludedEquipmentSelect
                    value={this.state.formData.includedEquipment || ''}
                    onChange={(value) => this.handleFieldChange('includedEquipment', value)}
                    error={this.state.errors.includedEquipment}
                    disabled={this.isFieldDisabled('includedEquipment')}
                  />
                </Grid>
                <Grid item xs={12}>
                  {this.renderTextField('includedServices', t('documentForm.fields.includedServices'))}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Lease & Financial Terms */}
          <Accordion
            expanded={this.isSectionExpanded('leaseTerms') || this.isSectionExpanded('utilityLimits')}
            onChange={this.handleAccordionChange('leaseTerms')}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.lease')}</Typography>
            </AccordionSummary>

            <FormControlLabel
              control={
                <Checkbox checked={this.state.formData.petsAllowed || false} onChange={(e) => this.handleCheckboxChange('petsAllowed', e.target.checked)} />
              }
              label={t('documentForm.fields.petsAllowed')}
            />

            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderDateField('date', t('documentForm.fields.agreementDate'), {})}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderNumberField('rentAmount', t('documentForm.fields.rentAmount'), { min: 0, step: '50', adornment: '₪' })}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderNumberField('leasePeriod', t('documentForm.fields.leasePeriod'), { min: 1, adornment: t('common.months') })}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderDateField('startDate', t('documentForm.fields.startDate'), {})}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderDateField('endDate', t('documentForm.fields.endDate'), {})}
                </Grid>

                <Grid item xs={6} sm={6} md={4}>
                  {this.renderNumberField('initialPaymentMonths', t('documentForm.fields.initialPaymentMonths'), { min: 0.5, max: 12, step: '0.5' })}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderDateField('standingOrderStart', t('documentForm.fields.standingOrderStart'), {})}
                </Grid>
                <Grid item xs={6} sm={6} md={4}>
                  {this.renderNumberField('paymentDay', t('documentForm.fields.paymentDay'), { min: 1, max: 31 })}
                </Grid>
              </Grid>
            </AccordionDetails>
            {/* Utility Limits */}
            <Accordion expanded={this.isSectionExpanded('utilityLimits')} onChange={this.handleAccordionChange('utilityLimits')}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography className='section-header'>{t('documentForm.sections.utilities')}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <p>{t('documentForm.messages.utilityLimitsNote')}</p>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={6} md={4}>
                    {this.renderNumberField('waterLimit', t('documentForm.fields.waterLimit'), { min: 0, step: '50', adornment: '₪' })}
                  </Grid>
                  <Grid item xs={6} sm={6} md={4}>
                    {this.renderNumberField('electricityLimit', t('documentForm.fields.electricityLimit'), { min: 0, step: '50', adornment: '₪' })}
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Accordion>

          {/* Landlord Details */}
          <Accordion expanded={this.isSectionExpanded('landlordDetails')} onChange={this.handleAccordionChange('landlordDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.landlord')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={7} sm={6} md={2}>
                  {this.renderTextField('landlordName', t('documentForm.fields.fullName'))}
                </Grid>
                <Grid item xs={5} sm={6} md={2}>
                  {this.renderNumberField('landlordId', t('documentForm.fields.israeliId'), { isIsraeliId: true })}
                </Grid>
                <Grid item xs={7} sm={6} md={3}>
                  {this.renderTextField('landlordEmail', t('documentForm.fields.email'), { type: 'email', isDisabled: true })}
                </Grid>
                <Grid item xs={5} sm={6} md={2}>
                  {this.renderNumberField('landlordPhone', t('documentForm.fields.phone'), { isPhoneNumber: true })}
                </Grid>
                <Grid item xs={12} sm={12} md={3}>
                  {this.renderTextField('landlordAddress', t('documentForm.fields.address'))}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Tenant1 Details */}
          <TenantSection
            prefix='tenant1'
            renderTextField={this.renderTextField}
            renderNumberField={this.renderNumberField}
            renderFileField={this.renderFileField}
            state={this.state}
            handleAccordionChange={this.handleAccordionChange}
            presignedUrls={this.props.selectedDocument?.presignedUrls}
            onImageViewerClose={() => this.setState({ showImagesViewer: false })}
            on2ndTenantToggle={() => this.setState({ showSecondTenant: !this.state.showSecondTenant, expandSecondTenant: true })}
            t={t}
          />

          {/* Tenant2 (optional) Details */}
          {this.state.showSecondTenant && (
            <TenantSection
              prefix='tenant2'
              renderTextField={this.renderTextField}
              renderNumberField={this.renderNumberField}
              renderFileField={this.renderFileField}
              state={this.state}
              handleAccordionChange={this.handleAccordionChange}
              presignedUrls={this.props.selectedDocument?.presignedUrls}
              onImageViewerClose={() => this.setState({ showImagesViewer: false })}
              t={t}
            />
          )}

          {/* Security Details */}
          <Accordion expanded={this.isSectionExpanded('securityDetails')} onChange={this.handleAccordionChange('securityDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.security')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(this.state.formData.securityRequired)}
                        onChange={(e) => this.handleCheckboxChange('securityRequired', e.target.checked)}
                        disabled={this.props.userType === UserType.Tenant || this.documentWasSigned()}
                      />
                    }
                    label={t('documentForm.fields.requireSecurityDeposit')}
                  />
                </Grid>
                <Grid item xs={6} sm={3} md={3}>
                  {this.renderNumberField('securityDeposit', t('documentForm.fields.securityDeposit'), {
                    min: 0,
                    adornment: '₪',
                    isDisabled: this.props.userType === UserType.Tenant,
                    isRequired: this.state.formData.securityRequired,
                  })}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Guarantor Details */}
          <Accordion expanded={this.isSectionExpanded('guarantorDetails')} onChange={this.handleAccordionChange('guarantorDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.guarantor')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(this.state.formData.guarantorRequired)}
                        onChange={(e) => this.handleCheckboxChange('guarantorRequired', e.target.checked)}
                        disabled={this.props.userType === UserType.Tenant || this.documentWasSigned()}
                      />
                    }
                    label={t('documentForm.fields.requireGuarantor')}
                  />
                </Grid>

                <Grid item xs={7} sm={8} md={4}>
                  {this.renderTextField('guarantorName', t('documentForm.fields.fullName'), {})}
                </Grid>
                <Grid item xs={5} sm={4} md={2}>
                  {this.renderNumberField('guarantorId', t('documentForm.fields.israeliId'), { isIsraeliId: true })}
                </Grid>
                <Grid item xs={7} sm={8} md={4}>
                  {this.renderTextField('guarantorAddress', t('documentForm.fields.address'), {})}
                </Grid>
                <Grid item xs={5} sm={4} md={2}>
                  {this.renderNumberField('guarantorPhone', t('documentForm.fields.phone'), { isPhoneNumber: true })}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Signature */}
          <Accordion expanded={this.isSectionExpanded('signature')} onChange={this.handleAccordionChange('signature')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>{t('documentForm.sections.signature')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid item xs={12}>
                <SignatureMaker
                  onSave={async (imageData) => {
                    await this.handleSignatureUpload(imageData);
                    this.handleAccordionChange('signature')(new Event('dummy') as any, false); // collapses the current section.
                    await this.handleSubmit(new Event('dummy') as any);
                  }}
                  onCancel={() => this.handleAccordionChange('signature')(new Event('dummy') as any, false)} // collapses the current section.
                />
              </Grid>
            </AccordionDetails>
          </Accordion>

          {
            /* To avoid closing the form unintentionally instead of the signature accordion */ !this.isSectionExpanded('signature') && (
              <div className='actions'>
                {(!this.props.documentId || this.hasUnsavedChanges()) && (
                  <button
                    type='submit'
                    className={`action-button save${this.hasUnsavedChanges() ? ' has-changes' : ''}`}
                    title={this.props.documentId ? 'Update' : 'Create'}
                  >
                    <Save />
                  </button>
                )}

                {this.renderCancelButton()}
              </div>
            )
          }
        </form>
      </Paper>
    );
  }

  private renderCancelButton = () => (
    <button type='button' className='action-button cancel' title={this.props.t('common.cancel')} onClick={this.handleCancel}>
      <Undo2 />
    </button>
  );

  /**
   * Handles changes in form fields
   * @param {string} field - Field name
   * @param {string} value - New value
   */
  handleFieldChange = (field: string, value: string) => {
    const { formData } = this.state;
    let newFormData = { ...formData };

    // For date fields, ensure we get YYYY-MM-DD format
    if (field === 'startDate' || field === 'endDate' || field === 'standingOrderStart') {
      if (value && !isNaN(new Date(value).getTime())) {
        value = value.split('T')[0]; // Just keep the date part
      }
    }

    // Auto-calculate endDate when startDate or leasePeriod changes
    if (field === 'startDate' || field === 'leasePeriod') {
      newFormData[field] = value;
      if (this.isValidDate(newFormData.startDate) && newFormData.leasePeriod) {
        newFormData.endDate = this.calculateEndDate(newFormData.startDate, newFormData.leasePeriod);
      }
      if (field === 'startDate') newFormData.standingOrderStart = value;
    } else {
      newFormData[field] = value;
    }

    // Validate field based on type and requirements
    const errors = { ...this.state.errors };
    Object.keys(newFormData).forEach((key) => {
      if (['startDate', 'endDate', 'standingOrderStart'].includes(key)) {
        errors[key] = this.validateField(key, newFormData[key]);
      }
    });

    this.setState({ formData: newFormData, errors });
  };

  /**
   * Validates a field value based on its type
   * @param field - Field name to validate
   * @param value - Value to validate
   * @returns Error message if invalid, empty string if valid
   */
  private validateField = (field: string, value: any, requiredFields: string[] = this.requiredFields): string => {
    const stringValue = String(value ?? '');
    const { formData } = this.state;
    const { t } = this.props;

    if (requiredFields.includes(field) && (!value || stringValue.trim() === '')) {
      return t('validation.required');
    }

    // Format validation for non-empty fields
    if (value && stringValue.trim()) {
      if (field === 'landlordId' || field === 'tenant1Id' || field === 'tenant2Id' || field === 'guarantorId') {
        //TODO: get the indication as a parameter to the function rather than asking about field names.
        if (!validateIsraeliId(stringValue)) {
          return t('validation.invalidId');
        }
      } else if (field === 'landlordPhone' || field === 'tenant1Phone' || field === 'tenant2Phone' || field === 'guarantorPhone') {
        //TODO: get the indication as a parameter to the function rather than asking about field names.
        const digits = stringValue.replace(/\D/g, '');
        if (!digits.startsWith('0')) {
          return t('validation.mustStartWithZero');
        } else if (!digits.startsWith('05')) {
          return t('validation.invalidPhone');
        } else if (digits.length < 10) {
          return t('validation.missingDigits');
        } else if (digits.length > 10) {
          return t('validation.tooManyDigits');
        } else if (!validateIsraeliPhone(stringValue)) {
          return t('validation.invalidPhone');
        }
      }

      // Date validations
      if (['startDate', 'endDate', 'standingOrderStart'].includes(field)) {
        if (!this.isValidDate(value)) {
          return t('validation.invalidDate');
        }

        const date = new Date(formData.date || '');
        const currentDate = new Date(value);

        // All dates must be after the agreement date
        if (this.isValidDate(formData.date) && currentDate < date) {
          return t('validation.dateMustBeAfterAgreement');
        }

        if (field === 'endDate' && this.isValidDate(formData.startDate)) {
          const startDate = new Date(formData.startDate);
          const minMonthsFromStartDate = new Date(startDate);
          const minMonthsFromStart = 3;
          minMonthsFromStartDate.setMonth(startDate.getMonth() + minMonthsFromStart - 1);

          if (currentDate < minMonthsFromStartDate) {
            return t('validation.endDateMinMonths', { months: minMonthsFromStart });
          }
        }

        if (field === 'standingOrderStart') {
          const startDate = new Date(formData.startDate);
          const endDate = new Date(formData.endDate);
          const initialMonths = parseInt(formData.initialPaymentMonths || '0');

          if (this.isValidDate(formData.startDate)) {
            const expectedStartDate = new Date(startDate);
            expectedStartDate.setMonth(startDate.getMonth() + initialMonths > 0 ? 1 : 0);

            if (currentDate < expectedStartDate) {
              return t('validation.standingOrderAfterInitial');
            }
          }

          if (this.isValidDate(formData.endDate) && currentDate > endDate) {
            return t('validation.standingOrderBeforeEnd');
          }
        }
      }
    }

    return '';
  };

  /**
   * Helper function to check if a date string is valid
   */
  private isValidDate = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };

  /**
   * Calculate end date based on start date and lease period
   */
  private calculateEndDate = (startDate: string, leasePeriod: string): string => {
    if (!this.isValidDate(startDate) || !leasePeriod) return '';

    const start = new Date(startDate);
    const months = parseFloat(leasePeriod);
    if (isNaN(months)) return '';

    // Add months to start date
    const end = new Date(start);
    end.setMonth(end.getMonth() + months - 1);

    // Set to last day of the month
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 1);
    return lastDay.toISOString().split('T')[0];
  };

  /**
   * Determines if a field should be disabled based on document state
   */
  private isFieldDisabled = (field: string) => {
    let isDisabled = this.documentWasSigned();
    if (!isDisabled) {
      const section = fieldToSection[field];
      // console.log({ field, section });
      const allowedSections =
        this.props.userType === UserType.Landlord
          ? ['landlordDetails', 'tenant1Details', 'tenant2Details', 'propertyDetails', 'leaseTerms', 'utilityLimits']
          : ['tenant1Details', 'tenant1Attachments', 'tenant2Details', 'tenant2Attachments'];

      if (this.state.formData.securityRequired) {
        allowedSections.push('securityDetails');
      }
      if (this.state.formData.guarantorRequired) {
        allowedSections.push('guarantorDetails');
      }
      isDisabled = !allowedSections.includes(section);
    }

    return isDisabled;
  };

  /**
   * Renders a text input field with common configuration
   * @param {string} field - Field name
   * @param {string} label - Field label
   * @param {string} [type=text] - Input type
   */
  private renderTextField = (field: string, label: string, options: { type?: string; isDisabled?: boolean; isRequired?: boolean } = { type: 'text' }) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];
    const isDisabled = this.isFieldDisabled(field) || options.isDisabled;
    const isRequired = this.requiredFields.includes(field) || options.isRequired;

    return (
      <TextField
        fullWidth
        name={field}
        label={label}
        value={value}
        onChange={(e) => this.handleFieldChange(field, e.target.value)}
        error={!!error}
        helperText={error}
        type={options.type}
        disabled={isDisabled}
        inputProps={{
          name: field,
        }}
        margin='normal'
        variant='outlined'
        size='small'
        className={(isRequired && !isDisabled && 'required') || ''}
      />
    );
  };

  /**
   * Renders a number input field
   */
  private renderNumberField = (
    field: string,
    label: string,
    options: {
      min?: number; // Minimum allowed value, e.g. min: 1 for room count
      max?: number; // Maximum allowed value, e.g. max: 31 for payment day
      step?: string; // Step increment for the field, e.g. step: '0.5' for partial months
      maxLength?: number; // Maximum length of the input
      adornment?: string; // Text/symbol shown after the input, e.g. '₪' for currency
      isIsraeliId?: boolean; // Whether to apply Israeli ID validation (9 digits + checksum)
      isPhoneNumber?: boolean; // Whether to apply Israeli phone number validation and formatting
      isDisabled?: boolean;
      isRequired?: boolean;
    } = {}
  ) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];
    const isDisabled = this.isFieldDisabled(field) || options.isDisabled;
    const isRequired = this.requiredFields.includes(field) || options.isRequired;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      if (options.isPhoneNumber) {
        newValue = newValue.replace(/\D/g, '');
        if (newValue.length > 0 && !newValue.startsWith('0')) {
          newValue = '0' + newValue.slice(1);
        }
        newValue = newValue.slice(0, 10);
        this.handleFieldChange(field, formatPhoneNumber(newValue));
        return;
      }

      if (options.isIsraeliId) {
        newValue = newValue.replace(/\D/g, '').slice(0, 9);
      } else {
        if (options.maxLength) {
          newValue = newValue.slice(0, options.maxLength);
        }
        if (options.max !== undefined) {
          const num = parseInt(newValue);
          if (!isNaN(num) && num > options.max) return;
        }
      }

      this.handleFieldChange(field, newValue);
    };

    const helperText = error || '';

    return (
      <TextField
        fullWidth
        name={field}
        label={label}
        InputLabelProps={{ sx: { fontSize: { xs: '0.6rem' /* small screens (mobile) */ }, color: 'gray' } }}
        value={value}
        onChange={handleChange}
        error={!!error}
        helperText={helperText}
        type={options.isIsraeliId || options.isPhoneNumber ? 'text' : 'number'}
        inputMode={options.isIsraeliId || options.isPhoneNumber ? 'numeric' : undefined}
        disabled={isDisabled}
        inputProps={{
          min: options.isIsraeliId || options.isPhoneNumber ? undefined : options.min,
          max: options.isIsraeliId || options.isPhoneNumber ? undefined : options.max,
          step: options.isIsraeliId || options.isPhoneNumber ? undefined : options.step,
          maxLength: options.maxLength,
          name: field,
        }}
        InputProps={{
          ...(options.adornment
            ? {
                startAdornment: (
                  <InputAdornment position='start' sx={{ '& .MuiTypography-root': { fontSize: '0.7rem' } }}>
                    {options.adornment}
                  </InputAdornment>
                ),
              }
            : {}),
        }}
        margin='normal'
        variant='outlined'
        size='small'
        className={(isRequired && !isDisabled && 'required') || ''}
      />
    );
  };

  /**
   * Renders a date picker field
   */
  private renderDateField = (field: string, label: string, options: { isRequired?: boolean; isDisabled?: boolean }) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];
    const isDisabled = this.isFieldDisabled(field) || options.isDisabled;
    const isRequired = this.requiredFields.includes(field) || options.isRequired;

    return (
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={he}>
        <DatePicker
          label={label}
          value={value ? new Date(value) : null}
          onChange={(date) => this.handleFieldChange(field, date?.toISOString().split('T')[0] || '')}
          format='dd/MM/yyyy'
          disabled={isDisabled}
          className={(isRequired && !isDisabled && 'required') || ''}
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!error,
              helperText: error,
              name: field,
              margin: 'normal',
              size: 'small',
              variant: 'outlined',
              inputProps: {
                name: field,
              },
            },
          }}
        />
      </LocalizationProvider>
    );
  };

  /**
   * Renders a file input field
   * @param {string} field - Field name
   * @param {string} label - Field label
   */
  private renderFileField = (field: string, label: string, options?: { onUpload?: () => void }) => {
    const existingFileName = this.state.formData[field];
    const error = this.state.errors[field];

    return (
      <div>
        <Typography>{label}</Typography>
        {existingFileName && (
          <Typography
            variant='body2'
            color='textSecondary'
            onClick={() => this.setState({ showImagesViewer: !this.state.showImagesViewer })}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Existing file: {existingFileName}
          </Typography>
        )}

        <input
          type='file'
          accept='image/*'
          onChange={(e) => {
            this.handleFileUpload(e.target.files, field);
            options?.onUpload?.();
          }}
          disabled={!this.props.documentId || this.isFieldDisabled(field)}
          className={this.requiredFields.includes(field) ? 'required' : ''}
        />

        {error && (
          <Typography variant='body2' color='error'>
            {error}
          </Typography>
        )}
      </div>
    );
  };

  /**
   * Handles changes to form input fields by updating the component's state
   * @param field - The name of the field to update in the form state
   * @param value - The new value for the field (can be any type - string for text fields, boolean for checkboxes, etc.)
   */
  private handleCheckboxChange = (field: string, value: any) => {
    this.setState({ formData: { ...this.state.formData, [field]: value } });
  };

  /**
   * Validates if all required fields in the document are filled
   * @param formData - The form data to validate
   * @returns boolean indicating if the document is valid
   */
  // private isDocumentValid = (): boolean => {
  //   // Check if all required fields have values
  //   return this.requiredFields.every((field) => {
  //     const value = this.state.formData[field];
  //     const isFieldValid = value !== undefined && value !== null && value !== '';
  //     // if (!isFieldValid) console.warn({ field, value, isFieldValid });
  //     return isFieldValid;
  //   });
  // };

  private documentWasSigned = (): boolean => !!this.state.formData.landlordSignature;

  private handleAccordionChange = (section: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    const { t } = this.props;
    // console.log(this.state, section, this.isDocumentValid());
    if (section === 'signature' && this.props.userType === UserType.Landlord && !this.state.formData.tenantSignature)
      toast.warning(t('documentForm.messages.tenantMustSignFirst'));
    else if (section === 'signature' && this.documentWasSigned()) toast.warning(t('documentForm.messages.agreementSignedByBoth'));
    else
      this.setState((prevState) => ({
        expandedSections: isExpanded ? [...prevState.expandedSections, section] : prevState.expandedSections.filter((s) => s !== section),
      }));
  };

  /**
   * Handles form submission
   * Validates required fields and submits data to create or update document
   * @param {React.FormEvent} e - Form submit event
   */
  private handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { documentId, createDocumentThunk, updateDocumentThunk, onSave, onClose, apartmentId, t } = this.props;

    // Validate all fields
    const errors: Record<string, string> = {};
    const sectionsWithErrors: string[] = [];

    // Get all fields that need validation (required fields + fields with values)
    const fieldsToValidate = new Set([
      ...this.requiredFields,
      ...(this.state.formData.securityRequired ? ['securityDeposit'] : []),
      ...(this.state.formData.guarantorRequired && this.props.userType === UserType.Tenant
        ? ['guarantorName', 'guarantorId', 'guarantorPhone', 'guarantorAddress']
        : []),
      ...Object.keys(this.state.formData).filter((field) => this.state.formData[field]),
    ]);

    const fieldsToValidateArray = Array.from(fieldsToValidate);
    // console.log(
    //   JSON.stringify(
    //     {
    //       fieldsToValidate: fieldsToValidateArray,
    //       formData: this.state.formData,
    //       requiredFields: this.requiredFields,
    //     },
    //     null,
    //     2
    //   )
    // );

    fieldsToValidate.forEach((field) => {
      const value = this.state.formData[field] || '';
      const error = this.validateField(field, value, fieldsToValidateArray);

      if (error) {
        errors[field] = error;
        const section = this.sectionMapping[field];
        if (section && !sectionsWithErrors.includes(section)) {
          sectionsWithErrors.push(section);
        }
      }
    });

    // If there are errors, show them and expand relevant sections
    if (Object.keys(errors).length > 0) {
      console.log(JSON.stringify({ errors, sectionsWithErrors }, null, 2));
      this.setState({ errors, expandedSections: sectionsWithErrors });
      return;
    }

    // Create new document or update existing one based on documentId
    try {
      let savedDocument: IDocument | null = null;
      if (documentId) {
        // update:
        const { userType } = this.props;
        if (
          userType === UserType.Landlord ||
          this.documentWasSigned() ||
          this.state.formData.tenantSignature ||
          window.confirm(t('documentForm.confirmSaveUnsigned'))
        ) {
          savedDocument = await updateDocumentThunk({
            documentId,
            templateFields: this.state.formData,
            ...(this.props.userType === UserType.Tenant && this.props.userId ? { tenantUserId: this.props.userId } : {}),
          });
        }
      } else {
        // create:
        savedDocument = await createDocumentThunk({ apartmentId: apartmentId as string, templateFields: this.state.formData });
      }
      if (savedDocument) {
        this.props.setSelectedDocument(savedDocument);
        if (onSave) onSave();
        if (onClose) onClose();
      }
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(t('messages.error'));
    }
  };

  /**
   * Handles the cancel action with confirmation if there are unsaved changes
   */
  private handleCancel = () => {
    if (this.hasUnsavedChanges()) {
      if (window.confirm(this.props.t('common.confirmUnsavedChanges'))) {
        this.props.onClose();
      }
    } else {
      this.props.onClose();
    }
  };

  /**
   * Checks if the form has any unsaved changes by comparing current state with initial values
   */
  private hasUnsavedChanges = (): boolean => {
    // Compare each field in the current form data with initial values
    return Object.keys(this.state.formData).some((field) => {
      const currentValue = this.state.formData[field];
      const initialValue = this.state.initialFormData[field] || '';
      // console.log({ field, currentValue, initialValue });

      // Handle special case for dates to normalize format
      if (['startDate', 'endDate', 'standingOrderStart', 'date'].includes(field)) {
        const currentDate = currentValue ? new Date(currentValue).toISOString().split('T')[0] : '';
        const initialDate = initialValue ? new Date(initialValue).toISOString().split('T')[0] : '';
        return currentDate !== initialDate;
      }

      // Handle boolean values
      if (typeof currentValue === 'boolean') {
        return currentValue !== Boolean(initialValue);
      }

      // Handle all other values
      return String(currentValue) !== String(initialValue);
    });
  };

  /**
   * Handles file upload and updates the formData state with the uploaded file's information.
   * @param files - FileList object containing selected files
   * @param fileName - Name of the file to be uploaded
   */
  private handleFileUpload = async (files: FileList | null, fileName: string) => {
    const { documentId, t } = this.props;
    if (!documentId) throw new Error("<input type='file' .. disabled={!this.props.documentId} />");
    if (files && files.length > 0) {
      const file = files[0];
      try {
        /*const { message, fileKey } =*/ await uploadFile({
          JWT: this.props.auth.JWT as string,
          file,
          fileName,
          documentId,
        });

        // Update formData with the uploaded file's name or metadata
        this.setState((prevState) => ({
          formData: {
            ...prevState.formData,
            [fileName]: file.name,
          },
          errors: { ...prevState.errors, [fileName]: '' },
          expandedSections: this.decideExpandedSections(prevState.expandedSections, { ...prevState.formData, [fileName]: file.name }, this.props.userType),
        }));

        toast.success(t('messages.fileUploaded', { fileName: file.name }));
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(t('messages.error'));
      }
    }
  };

  /**
   * Handles image content upload and updates the formData state with the uploaded file's information.
   * @param files - FileList object containing selected files
   * @param fileName - Name of the file to be uploaded
   */
  private handleSignatureUpload = async (imageData: string): Promise<void> => {
    const { t } = this.props;
    try {
      const documentId = this.props.documentId;
      const fileName = `${this.props.userType === 'Tenant' ? 'tenant' : 'landlord'}Signature`;

      /*const { message, fileKey } =*/ await uploadContent({
        JWT: this.props.auth.JWT as string,
        content: imageData,
        fileName,
        documentId,
      });

      // Update formData with the signature data and wait for it to complete
      await new Promise<void>((resolve) => {
        this.setState(
          (prevState) => ({
            formData: {
              ...prevState.formData,
              [fileName]: `${fileName}-${new Date().toISOString()}`,
            },
          }),
          resolve
        );
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error(t('messages.error'));
      throw error; // Re-throw the error so we know if the upload failed
    }
  };

  toggleSecondTenant = () => {
    this.setState((prevState) => ({ showSecondTenant: !prevState.showSecondTenant }));
  };
}

interface TenantSectionProps {
  prefix: string;
  renderTextField: (name: string, label: string, options?: any) => React.ReactNode;
  renderNumberField: (name: string, label: string, options?: any) => React.ReactNode;
  renderFileField: (name: string, label: string, options?: { onUpload?: () => void }) => React.ReactNode;
  state: DocumentFormState;
  handleAccordionChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
  presignedUrls?: Record<string, string>;
  onImageViewerClose: () => void;
  on2ndTenantToggle?: () => void;
  t: (key: string, options?: any) => string;
}

const TenantSection: React.FC<TenantSectionProps> = ({
  prefix,
  renderTextField,
  renderNumberField,
  renderFileField,
  state,
  handleAccordionChange,
  presignedUrls,
  onImageViewerClose,
  on2ndTenantToggle,
  t,
}) => {
  const sectionId = `${prefix}Details`;
  const attachmentsId = `${prefix}Attachments`;

  return (
    <Accordion
      expanded={state.expandSecondTenant || state.expandedSections.includes(sectionId) || state.expandedSections.includes(attachmentsId)}
      onChange={handleAccordionChange(sectionId)}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography className='section-header'>
          {t('documentForm.sections.tenant')}
          {prefix === 'tenant2' ? ' 2' : state.showSecondTenant ? ' 1' : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={7} sm={6} md={2}>
            {renderTextField(`${prefix}Name`, t('documentForm.fields.fullName'))}
          </Grid>
          <Grid item xs={5} sm={6} md={2}>
            {renderNumberField(`${prefix}Id`, t('documentForm.fields.israeliId'), { isIsraeliId: true })}
          </Grid>
          <Grid item xs={7} sm={6} md={3}>
            {renderTextField(`${prefix}Email`, t('documentForm.fields.email'), { type: 'email', isDisabled: true })}
          </Grid>
          <Grid item xs={5} sm={6} md={2}>
            {renderNumberField(`${prefix}Phone`, t('documentForm.fields.phone'), { isPhoneNumber: true })}
          </Grid>
          <Grid item xs={12} sm={12} md={3}>
            {renderTextField(`${prefix}Address`, t('documentForm.fields.address'))}
          </Grid>
        </Grid>

        {/* Tenant Attachments */}
        <Accordion expanded={state.expandedSections.includes(attachmentsId)} onChange={handleAccordionChange(attachmentsId)}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography className='section-header'>{t('documentForm.attachments.title')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                {renderFileField(`${prefix}IdCard`, t('documentForm.attachments.idCard'))}
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                {renderFileField(`${prefix}Salary1`, t('documentForm.attachments.salary1'))}
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                {renderFileField(`${prefix}Salary2`, t('documentForm.attachments.salary2'))}
              </Grid>
            </Grid>
          </AccordionDetails>

          {presignedUrls && state.showImagesViewer && <ImagesViewer presignedUrls={presignedUrls} onClose={onImageViewerClose} />}
        </Accordion>

        {state.expandedSections.includes(sectionId) && on2ndTenantToggle && (
          <Tooltip title={t('common.tooltips.addSecondTenant')}>
            <Plus id='plus-icon' className='action-button' onClick={on2ndTenantToggle} />
          </Tooltip>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Base interface for document payloads
 */
interface DocumentPayload {
  templateFields: Record<string, any>; // Template fields for the document
}

/**
 * Payload for creating a new document
 */
interface CreateDocumentPayload extends DocumentPayload {
  apartmentId: string; // ID of the apartment this document belongs to
}

/**
 * Payload for updating an existing document
 */
interface UpdateDocumentPayload extends DocumentPayload {
  documentId: string; // ID of the document to update
  tenantUserId?: string; // ID of the tenant
}

/**
 * Props passed directly to DocumentForm component
 */
interface OwnProps {
  documentId?: string; // ID of the document being edited, undefined for new documents
  onClose: () => void; // Callback when form is closed
  onSave?: () => void; // Optional callback when document is saved

  // relevant only when create mode is allowed:
  apartmentId?: string; // ID of the apartment this document belongs to
  initialTemplateFields?: Record<string, any> | null; // Initial template fields for the document
  apartmentInitiatedFields?: {
    propertyAddress: string;
    roomCount: number;
    rentAmount: number;
  };
}

/**
 * Props from Redux state
 */
interface StateProps {
  selectedDocument: IDocument | null;
  userType: UserType;
  userId: string | null;
  auth: IAuthState;
  saasTenants: ISaasTenant[];
}

/**
 * Props from Redux dispatch
 */
interface DispatchProps {
  createDocumentThunk: (payload: CreateDocumentPayload) => Promise<IDocument>;
  updateDocumentThunk: (payload: UpdateDocumentPayload) => Promise<IDocument>;
  setSelectedDocument: (document: IDocument | null) => void;
}

/**
 * Combined props type for the DocumentForm component
 */
type DocumentFormProps = OwnProps &
  StateProps &
  DispatchProps & {
    t: (key: string, options?: any) => string;
    i18n: i18n;
  };

/**
 * Component state interface
 */
interface DocumentFormState {
  formData: Record<string, any>;
  errors: Record<string, string>;
  expandedSections: string[];
  initialFormData: Record<string, any>;
  showImagesViewer: boolean;
  showSecondTenant: boolean;
  expandSecondTenant: boolean;
}

const mapStateToProps = (state: RootState) => ({
  selectedDocument: state.documents.selectedDocument,
  userType: state.auth.userType,
  userId: state.auth.userId,
  auth: state.auth,
  saasTenants: state.saasTenants.saasTenants,
});

/**
 * Maps Redux dispatch to component props
 */
const mapDispatchToProps = (dispatch: ThunkDispatch<RootState, unknown, AnyAction>) => ({
  getDocumentThunk: async (id: string) => {
    const action = await dispatch(getDocumentThunk(id));
    return action.payload as IDocument;
  },
  createDocumentThunk: async (payload: CreateDocumentPayload) => {
    const action = await dispatch(createDocumentThunk(payload));
    return action.payload as IDocument;
  },
  updateDocumentThunk: async (payload: UpdateDocumentPayload) => {
    const action = await dispatch(updateDocumentThunk(payload));
    return action.payload as IDocument;
  },
  setSelectedDocument: (document: IDocument | null) => dispatch(documentActions.setSelectedDocument(document)),
});

const connector = connect(mapStateToProps, mapDispatchToProps);
export default withTranslation()(connector(DocumentForm));
