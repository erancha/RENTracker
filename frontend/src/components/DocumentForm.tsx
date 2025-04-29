import React from 'react';
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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ExpandMore } from '@mui/icons-material';
import { Save, Undo2 } from 'lucide-react';
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
    tenantName: '',
    tenantId: '',
    tenantPhone: '',
    tenantEmail: '',
    tenantAddress: '',
    idCard: '',
    salary1: '',
    salary2: '',
    propertyAddress: '',
    roomCount: '',
    leasePeriod: '12',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1, 12).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 13, 0, 12).toISOString().split('T')[0],
    rentAmount: '',
    paymentDay: '1',
    initialPaymentMonths: '1',
    standingOrderStart: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1, 12).toISOString().split('T')[0],
    waterLimit: '150',
    electricityLimit: '250',
    includedServices: 'יס וקו אינטרנט',
    includedEquipment: 'מקרר, מכונת כביסה, מייבש, מזגן',
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
    ...(this.props.userType === UserType.Tenant ? ['tenantName', 'tenantId', 'tenantPhone', 'tenantEmail', 'idCard', 'salary1', 'salary2'] : []),
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

  /**
   * Populates user name and email fields based on user type if they are not already set
   * @private
   */
  private populateCurrentUserFields = (templateFields: Record<string, any>, userType: UserType, userName: string, email: string): Record<string, any> => {
    const fields = { ...templateFields };
    if (!fields.landlordName && userType === UserType.Landlord) {
      fields.landlordName = userName || '';
    }
    if (!fields.landlordEmail && userType === UserType.Landlord) {
      fields.landlordEmail = email || '';
    }
    if (!fields.tenantEmail && userType === UserType.Tenant) {
      fields.tenantEmail = email || '';
    }
    return fields;
  };

  constructor(props: DocumentFormProps) {
    super(props);

    // Initialize default fields with apartment-specific values if available
    this.defaultTemplateFields = {
      ...this.defaultTemplateFields,
      ...(props.apartmentInitiatedFields && {
        propertyAddress: props.apartmentInitiatedFields.propertyAddress,
        roomCount: props.apartmentInitiatedFields.roomsCount,
        rentAmount: props.apartmentInitiatedFields.rentAmount,
      }),
    };

    // Start with either selected document fields or initial fields
    let templateFields = props.selectedDocument?.template_fields || props.initialTemplateFields || this.defaultTemplateFields;

    // Create a new object to avoid mutating the source and populate user name and emails
    templateFields = this.populateCurrentUserFields(templateFields, props.userType, props.auth.userName as string, props.auth.email as string);

    // Initialize state
    this.state = {
      formData: templateFields,
      errors: {},
      expandedSections: props.expandedSections || (props.userType === UserType.Tenant ? ['tenantDetails'] : []),
      initialFormData: templateFields, // Store the initial populated fields
      showImagesViewer: false,
    };
  }

  /**
   * Lifecycle method to initialize form data
   * Fetches document data if in edit mode or sets up new document if in create mode
   */
  componentDidMount() {
    const { documentId, selectedDocument, initialTemplateFields, userType, auth } = this.props;

    if (initialTemplateFields) {
      // Use duplicated fields and populate user name and emails if needed
      const templateFields = this.populateCurrentUserFields(initialTemplateFields, userType, auth.userName as string, auth.email as string);
      this.setState({
        formData: templateFields,
      });
    } else if (documentId && selectedDocument) {
      // Edit mode - use selected document fields and populate user name and emails if needed
      const templateFields = this.populateCurrentUserFields(selectedDocument.template_fields, userType, auth.userName as string, auth.email as string);
      this.setState({
        formData: templateFields,
        expandedSections: userType === UserType.Tenant ? ['tenantDetails'] : [],
      });
    } else if (!documentId) {
      // Create mode - use defaults and populate user name and emails if needed
      const templateFields = this.populateCurrentUserFields(this.defaultTemplateFields, userType, auth.userName as string, auth.email as string);
      this.setState({ formData: templateFields });
    }
    // If documentId exists but no selectedDocument, wait for it in componentDidUpdate
  }

  /**
   * Update form when selected document is loaded
   */
  componentDidUpdate(prevProps: DocumentFormProps) {
    const { selectedDocument, userType, auth } = this.props;

    // If we just received the document data
    if (selectedDocument && (!prevProps.selectedDocument || prevProps.selectedDocument.document_id !== selectedDocument.document_id)) {
      // Update template fields and set populate user name and emails if needed
      const templateFields = this.populateCurrentUserFields(selectedDocument.template_fields, userType, auth.userName as string, auth.email as string);
      this.setState({
        formData: templateFields,
        // Only auto-expand for tenants
        expandedSections: userType === UserType.Tenant ? ['tenantDetails'] : [],
      });
    }
  }

  render() {
    return (
      <Paper sx={{ p: 2 }}>
        <form onSubmit={this.handleSubmit} noValidate>
          <Box sx={{ mb: 2 }}>
            <Typography variant='h5' gutterBottom>
              {getDocumentTitle(this.state.formData?.tenantName)}
            </Typography>
          </Box>

          {/* Basic Information */}
          <Accordion expanded={this.state.expandedSections.includes('basic')} onChange={this.handleAccordionChange('basic')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>פרטים בסיסיים</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderDateField('date', 'תאריך ההסכם')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Landlord Details */}
          <Accordion expanded={this.state.expandedSections.includes('landlordDetails')} onChange={this.handleAccordionChange('landlordDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>פרטי משכיר</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderTextField('landlordName', 'שם מלא')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('landlordId', 'תעודת זהות', { isIsraeliId: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('landlordPhone', 'טלפון', { isPhoneNumber: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderTextField('landlordEmail', 'דוא״ל', { type: 'email', isDisabled: true })}
                </Grid>
                <Grid item xs={12}>
                  {this.renderTextField('landlordAddress', 'כתובת')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Tenant Details */}
          <Accordion expanded={this.state.expandedSections.includes('tenantDetails')} onChange={this.handleAccordionChange('tenantDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>פרטי שוכר</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderTextField('tenantName', 'שם מלא')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('tenantId', 'תעודת זהות', { isIsraeliId: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('tenantPhone', 'טלפון', { isPhoneNumber: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderTextField('tenantEmail', 'דוא״ל', { type: 'email', isDisabled: this.props.userType === UserType.Tenant })}
                </Grid>
                <Grid item xs={12}>
                  {this.renderTextField('tenantAddress', 'כתובת')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Attachments */}
          <Accordion expanded={this.state.expandedSections.includes('attachments')} onChange={this.handleAccordionChange('attachments')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>קבצים מצורפים</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderFileField('idCard', 'צילום ת.ז')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderFileField('salary1', 'צילום משכורת 1')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderFileField('salary2', 'צילום משכורת 2')}
                </Grid>
              </Grid>
            </AccordionDetails>

            {this.props.selectedDocument?.presignedUrls && this.state.showImagesViewer && (
              <ImagesViewer presignedUrls={this.props.selectedDocument?.presignedUrls || {}} onClose={() => this.setState({ showImagesViewer: false })} />
            )}
          </Accordion>

          {/* Property Details */}
          <Accordion expanded={this.state.expandedSections.includes('propertyDetails')} onChange={this.handleAccordionChange('propertyDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>פרטי הנכס</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  {this.renderTextField('propertyAddress', 'כתובת הנכס', { isDisabled: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('roomCount', 'מספר חדרים', { min: 1, max: 20, step: '0.5', isDisabled: true })}
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
                  {this.renderTextField('includedServices', 'שירותים כלולים')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Lease & Financial Terms */}
          <Accordion expanded={this.state.expandedSections.includes('leaseTerms')} onChange={this.handleAccordionChange('leaseTerms')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>תנאי השכירות</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('leasePeriod', 'תקופת שכירות', { min: 1, adornment: 'חודשים' })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('rentAmount', 'דמי שכירות', { min: 0, step: '50', adornment: '₪' })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderDateField('startDate', 'תאריך תחילה')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderDateField('endDate', 'תאריך סיום')}
                </Grid>

                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('initialPaymentMonths', 'מספר חודשים בתשלום מראש', { min: 0.5, max: 12, step: '0.5' })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('paymentDay', 'יום תשלום בחודש', { min: 1, max: 31 })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderDateField('standingOrderStart', 'תחילת תשלום חודשי')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Utility Limits */}
          <Accordion expanded={this.state.expandedSections.includes('utilityLimits')} onChange={this.handleAccordionChange('utilityLimits')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>מגבלות צריכה</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('waterLimit', 'מגבלת מים', { min: 0, step: '50', adornment: '₪' })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('electricityLimit', 'מגבלת חשמל', { min: 0, adornment: '₪' })}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Security Details */}
          <Accordion expanded={this.state.expandedSections.includes('securityDetails')} onChange={this.handleAccordionChange('securityDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>בטחונות וערבויות (אופציונלי)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(this.state.formData.securityRequired)}
                        onChange={(e) => this.handleInputChange('securityRequired', e.target.checked)}
                        disabled={this.props.userType === UserType.Tenant}
                      />
                    }
                    label='דרוש פיקדון בטחון'
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('securityDeposit', 'סכום פיקדון', { min: 0, adornment: '₪', isDisabled: this.props.userType === UserType.Tenant })}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Guarantor Details */}
          <Accordion expanded={this.state.expandedSections.includes('guarantorDetails')} onChange={this.handleAccordionChange('guarantorDetails')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>פרטי ערב (אופציונלי)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(this.state.formData.guarantorRequired)}
                        onChange={(e) => this.handleInputChange('guarantorRequired', e.target.checked)}
                        disabled={this.props.userType === UserType.Tenant}
                      />
                    }
                    label='דרוש ערב'
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderTextField('guarantorName', 'שם מלא')}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('guarantorId', 'תעודת זהות', { isIsraeliId: true })}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {this.renderNumberField('guarantorPhone', 'טלפון', { isPhoneNumber: true })}
                </Grid>
                <Grid item xs={12}>
                  {this.renderTextField('guarantorAddress', 'כתובת')}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Signature */}
          <Accordion expanded={this.state.expandedSections.includes('signature')} onChange={this.handleAccordionChange('signature')}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography className='section-header'>חתימה</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid item xs={12}>
                <SignatureMaker
                  onSave={(imageData) => {
                    this.handleSignatureUpload(imageData);
                    this.handleAccordionChange('signature')(new Event('dummy') as any, false); // collapses the current section.
                  }}
                  onCancel={() => this.handleAccordionChange('signature')(new Event('dummy') as any, false)} // collapses the current section.
                />
              </Grid>
            </AccordionDetails>
          </Accordion>

          {
            /* To avoid closing the form unintentionally instead of the signature accordion */ !this.state.expandedSections.includes('signature') && (
              <div className='actions'>
                <button type='submit' className='action-button save' title={this.props.documentId ? 'Update' : 'Create'}>
                  <Save />
                </button>
                <button type='button' className='action-button cancel' title='Cancel' onClick={this.handleCancel}>
                  <Undo2 />
                </button>
              </div>
            )
          }
        </form>
      </Paper>
    );
  }

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

    this.setState({
      formData: newFormData,
      errors,
    });
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

    if (requiredFields.includes(field) && (!value || stringValue.trim() === '')) {
      return 'שדה חובה';
    }

    // Format validation for non-empty fields
    if (value && stringValue.trim()) {
      if (field === 'landlordId' || field === 'tenantId' || field === 'guarantorId') {
        //TODO: get the indication as a parameter to the function rather than asking about field names.
        if (!this.validateIsraeliId(stringValue)) {
          return 'מספר תעודת זהות לא תקין';
        }
      } else if (field === 'landlordPhone' || field === 'tenantPhone' || field === 'guarantorPhone') {
        //TODO: get the indication as a parameter to the function rather than asking about field names.
        const digits = stringValue.replace(/\D/g, '');
        if (!digits.startsWith('0')) {
          return 'חייב להתחיל ב-0';
        } else if (!digits.startsWith('05')) {
          return 'מספר טלפון לא תקין';
        } else if (digits.length < 10) {
          return 'חסרות ספרות';
        } else if (digits.length > 10) {
          return 'יותר מדי ספרות';
        } else if (!this.validateIsraeliPhone(stringValue)) {
          return 'מספר טלפון לא תקין';
        }
      } else if (field === 'landlordEmail' || field === 'tenantEmail') {
        if (!this.validateEmail(stringValue)) {
          return 'כתובת דוא״ל לא תקינה';
        }
      }

      // Date validations
      if (['startDate', 'endDate', 'standingOrderStart'].includes(field)) {
        if (!this.isValidDate(value)) {
          return 'תאריך לא תקין';
        }

        const date = new Date(formData.date || '');
        const currentDate = new Date(value);

        // All dates must be after the agreement date
        if (this.isValidDate(formData.date) && currentDate < date) {
          return 'התאריך חייב להיות אחרי תאריך ההסכם';
        }

        if (field === 'endDate' && this.isValidDate(formData.startDate)) {
          const startDate = new Date(formData.startDate);
          const minMonthsFromStartDate = new Date(startDate);
          const minMonthsFromStart = 3;
          minMonthsFromStartDate.setMonth(startDate.getMonth() + minMonthsFromStart - 1);

          if (currentDate < minMonthsFromStartDate) {
            return `תאריך סיום חייב להיות לפחות ${minMonthsFromStart} חודשים אחרי תאריך התחלה`;
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
              return 'תאריך תחילת הוראת קבע חייב להיות אחרי תקופת התשלום הראשוני';
            }
          }

          if (this.isValidDate(formData.endDate) && currentDate > endDate) {
            return 'תאריך תחילת הוראת קבע חייב להיות לפני תאריך סיום ההסכם';
          }
        }
      }
    }

    return '';
  };

  private validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
   * Validates an Israeli ID number using the Luhn algorithm
   */
  private validateIsraeliId = (id: string): boolean => {
    // Remove any non-digit characters
    id = id.replace(/\D/g, '');
    if (id.length !== 9) return false;

    const digits = id.split('').map(Number);
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      let digit = digits[i] * ((i % 2) + 1);
      digit = digit > 9 ? digit - 9 : digit;
      sum += digit;
    }

    return (10 - (sum % 10)) % 10 === digits[8];
  };

  /**
   * Validates an Israeli mobile phone number
   */
  private validateIsraeliPhone = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    // Empty is valid (not required field)
    if (digits.length === 0) return true;
    // Must be exactly 10 digits starting with 05X
    return /^05\d{8}$/.test(digits);
  };

  /**
   * Formats a phone number
   */
  private formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  /**
   * Determines if a field should be disabled based on document state
   */
  private isFieldDisabled = (field: string) => {
    const section = fieldToSection[field];
    const allowedSections =
      this.props.userType === UserType.Landlord
        ? ['basic', 'landlordDetails', 'tenantDetails', 'propertyDetails', 'leaseTerms', 'utilityLimits']
        : ['tenantDetails'];

    if (this.state.formData.securityRequired) {
      allowedSections.push('securityDetails');
    }
    if (this.state.formData.guarantorRequired) {
      allowedSections.push('guarantorDetails');
    }

    return !allowedSections.includes(section);
  };

  /**
   * Renders a text input field with common configuration
   * @param {string} field - Field name
   * @param {string} label - Field label
   * @param {string} [type=text] - Input type
   */
  private renderTextField = (field: string, label: string, options: { type?: string; isDisabled?: boolean } = { type: 'text' }) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];

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
        disabled={this.isFieldDisabled(field) || options.isDisabled}
        inputProps={{
          name: field,
        }}
        margin='normal'
        variant='outlined'
        size='small'
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
    } = {}
  ) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      if (options.isPhoneNumber) {
        newValue = newValue.replace(/\D/g, '');
        if (newValue.length > 0 && !newValue.startsWith('0')) {
          newValue = '0' + newValue.slice(1);
        }
        newValue = newValue.slice(0, 10);
        this.handleFieldChange(field, this.formatPhoneNumber(newValue));
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
        value={value}
        onChange={handleChange}
        error={!!error}
        helperText={helperText}
        type={options.isIsraeliId || options.isPhoneNumber ? 'text' : 'number'}
        inputMode={options.isIsraeliId || options.isPhoneNumber ? 'numeric' : undefined}
        disabled={this.isFieldDisabled(field) || options.isDisabled}
        inputProps={{
          min: options.isIsraeliId || options.isPhoneNumber ? undefined : options.min,
          max: options.isIsraeliId || options.isPhoneNumber ? undefined : options.max,
          step: options.isIsraeliId || options.isPhoneNumber ? undefined : options.step,
          maxLength: options.maxLength,
          name: field,
        }}
        InputProps={{
          ...(options.adornment ? { endAdornment: <InputAdornment position='end'>{options.adornment}</InputAdornment> } : {}),
        }}
        margin='normal'
        variant='outlined'
        size='small'
      />
    );
  };

  /**
   * Renders a date picker field
   */
  private renderDateField = (field: string, label: string) => {
    const value = this.state.formData[field] || '';
    const error = this.state.errors[field];

    return (
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={he}>
        <DatePicker
          label={label}
          value={value ? new Date(value) : null}
          onChange={(date) => this.handleFieldChange(field, date?.toISOString().split('T')[0] || '')}
          format='dd/MM/yyyy'
          disabled={this.isFieldDisabled(field)}
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
  private renderFileField = (field: string, label: string) => {
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

        <input type='file' accept='image/*' onChange={(e) => this.handleFileUpload(e.target.files, field)} disabled={!this.props.documentId} />
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
  private handleInputChange = (field: string, value: any) => {
    this.setState({
      formData: {
        ...this.state.formData,
        [field]: value,
      },
    });
  };

  private handleAccordionChange = (section: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
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
    const { documentId, createDocumentThunk, updateDocumentThunk, onSave, onClose, apartmentId } = this.props;

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
      this.setState({
        errors,
        expandedSections: sectionsWithErrors,
      });
      return;
    }

    // Create new document or update existing one based on documentId
    try {
      let savedDocument: IDocument;
      if (documentId) {
        savedDocument = await updateDocumentThunk({
          documentId,
          templateFields: this.state.formData,
          ...(this.props.userType === UserType.Tenant && this.props.userId ? { tenantUserId: this.props.userId } : {}),
        });
      } else {
        savedDocument = await createDocumentThunk({ apartmentId: apartmentId as string, templateFields: this.state.formData });
      }
      this.props.setSelectedDocument(savedDocument);

      if (onSave) onSave();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(`Failed to ${documentId ? 'update' : 'create'} document. Please try again.`);
    }
  };

  /**
   * Handles the cancel action with confirmation if there are unsaved changes
   */
  private handleCancel = () => {
    if (this.hasUnsavedChanges()) {
      if (window.confirm('יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לבטל?')) {
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
    const { documentId } = this.props;
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
            [fileName]: file.name, // Store the file name or any relevant metadata
          },
        }));

        toast.success(`File '${file.name}' uploaded successfully!`);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload file. Please try again.');
      }
    }
  };

  /**
   * Handles image content upload and updates the formData state with the uploaded file's information.
   * @param files - FileList object containing selected files
   * @param fileName - Name of the file to be uploaded
   */
  private handleSignatureUpload = async (imageData: string) => {
    try {
      const documentId = this.props.documentId;
      const fileName = 'signature';

      /*const { message, fileKey } =*/ await uploadContent({
        JWT: this.props.auth.JWT as string,
        content: imageData,
        fileName,
        documentId,
      });

      // Update formData with the signature data
      this.setState((prevState) => ({
        formData: {
          ...prevState.formData,
          [fileName]: fileName,
        },
      }));

      toast.success('Signature saved successfully!', { autoClose: 1000 });
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature. Please try again.');
    }
  };
}

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
    roomsCount: number;
    rentAmount: number;
  };
  expandedSections?: string[];
}

/**
 * Props from Redux state
 */
interface StateProps {
  selectedDocument: IDocument | null;
  userType: UserType;
  userId: string | null;
  auth: IAuthState;
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
type DocumentFormProps = OwnProps & StateProps & DispatchProps;

/**
 * Component state interface
 */
interface DocumentFormState {
  formData: Record<string, any>;
  errors: Record<string, string>;
  expandedSections: string[];
  initialFormData: Record<string, any>;
  showImagesViewer: boolean;
}

const mapStateToProps = (state: RootState) => ({
  selectedDocument: state.documents.selectedDocument,
  userType: state.auth.userType,
  userId: state.auth.userId,
  email: state.auth.email,
  auth: state.auth,
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
export default connector(DocumentForm);
