import React from 'react';
import { connect } from 'react-redux';
import { ISaasTenant, INewSaasTenant } from '../redux/saasTenants/types';
import {
  prepareCreateSaasTenantCommandAction,
  addSaasTenantAction,
  prepareUpdateSaasTenantCommandAction,
  updateSaasTenantAction,
  prepareDeleteSaasTenantCommandAction,
  deleteSaasTenantAction,
} from '../redux/saasTenants/actions';
import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { timeShortDisplay, validateIsraeliPhone, validateEmail, validateIsraeliId, formatPhoneNumber } from 'utils/utils';
import { IAppState } from 'redux/store/types';
import { UserType } from 'redux/auth/types';

class SaaSTenants extends React.Component<ISaaSTenantsProps, ISaaSTenantsState> {
  private createInitialTenant = (): INewSaasTenant => ({
    saas_tenant_id: this.props.userId,
    email: this.props.email,
    name: this.props.userName,
    is_disabled: false,
    israeli_id: '',
    phone: '',
    address: '',
  });

  constructor(props: ISaaSTenantsProps) {
    super(props);
    this.state = {
      showNewSaaSTenant: false,
      newSaaSTenant: this.createInitialTenant(),
      editedTenants: {},
      errors: {},
    };
  }

  componentDidMount() {
    /* Auto open new SaaS tenant form if the current user is not yet a SaaS tenant */
    if (this.props.userType !== UserType.Admin && !this.props.saasTenants.some((t) => t.saas_tenant_id === this.props.userId))
      this.setState({ ...this.state, showNewSaaSTenant: true });
  }

  render(): React.ReactNode {
    const { saasTenants } = this.props;
    const { showNewSaaSTenant, newSaaSTenant } = this.state;

    return (
      <div className='page body-container saas-tenants'>
        <div className='header m-n-relation'>
          <span>SaaS Tenants</span>
          {
            /* allow adding SaaS tenants only by admin or only if the current user is not yet a SaaS tenant */
            (this.props.userType === UserType.Admin || !this.props.saasTenants.some((t) => t.saas_tenant_id === this.props.userId)) && (
              <button
                onClick={() => {
                  this.setState({
                    showNewSaaSTenant: true,
                    newSaaSTenant: this.createInitialTenant(),
                  });
                }}
                className='action-button add'
              >
                <Plus />
              </button>
            )
          }
        </div>

        <div className='saas-tenants-container'>
          <div className='table-header saas-tenant'>
            <div className='updated-at'>Updated At</div>
            <div className='saas-tenant-id'>Tenant ID</div>
            <div className='email'>Email</div>
            <div className='name'>Name</div>
            <div className='phone'>Phone</div>
            <div className='israeli-id'>Israeli ID</div>
            <div className='address'>Address</div>
            <div className='actions'>Actions</div>
          </div>

          <div className='data-container saas-tenant-list'>
            {showNewSaaSTenant && <div className='table-row saas-tenant input'>{this.renderTenant(newSaaSTenant)}</div>}

            {saasTenants.length > 0 ? (
              (this.props.userType === UserType.Admin ? saasTenants : saasTenants.filter((t) => t.saas_tenant_id === this.props.userId)).map(
                (saasTenant, index) => (
                  <div
                    key={saasTenant.saas_tenant_id}
                    tabIndex={index}
                    className={`table-row saas-tenant${saasTenant.onroute ? ' onroute' : ''}${saasTenant.is_disabled ? ' is_disabled' : ''}`}
                  >
                    {this.renderTenant(saasTenant)}
                  </div>
                )
              )
            ) : (
              <div className='empty-message'>No SaaS Tenants found...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Renders a single saasTenant row
   * @param {Partial<ISaasTenant>} saasTenant - Tenant to render
   * @returns {JSX.Element} The rendered saasTenant row
   */
  private renderTenant = (saasTenant: Partial<ISaasTenant>) => {
    const isSaved = 'created_at' in saasTenant;

    // If tenant is being edited, use the edited values
    const displayTenant = isSaved && this.state.editedTenants[saasTenant.saas_tenant_id!] ? this.state.editedTenants[saasTenant.saas_tenant_id!] : saasTenant;

    return (
      <>
        <div data-title='Updated At'>{saasTenant.updated_at ? timeShortDisplay(new Date(saasTenant.updated_at)) : ''}</div>
        <div data-title='SaaS Tenant ID'>
          <span className='saas-tenant-id'>{saasTenant.saas_tenant_id}</span>
        </div>
        <div data-title='Email'>
          <span className='email'>{saasTenant.email}</span>
        </div>
        <div data-title='Name' className='input-and-error-container'>
          <input
            type='text'
            value={displayTenant.name || ''}
            onChange={(e) => {
              if (isSaved) {
                this.handleEditTenantChange(saasTenant.saas_tenant_id!, 'name', e.target.value);
              } else {
                this.handleNewTenantChange('name', e.target.value);
              }
            }}
            placeholder='Enter Name'
            className={`name ${this.state.errors.name ? 'error' : ''}`}
          />
          {this.state.errors.name && (!isSaved || this.isEditingTenant(saasTenant.saas_tenant_id!)) && (
            <span className='error-message'>{this.state.errors.name}</span>
          )}
        </div>
        <div data-title='Phone' className='input-and-error-container'>
          <input
            type='text'
            value={displayTenant.phone || ''}
            onChange={(e) => {
              const formattedPhone = formatPhoneNumber(e.target.value);
              if (isSaved) {
                this.handleEditTenantChange(saasTenant.saas_tenant_id!, 'phone', formattedPhone);
              } else {
                this.handleNewTenantChange('phone', formattedPhone);
              }
            }}
            placeholder='Enter Phone (05X-XXX-XXXX)'
            className={`phone ${this.state.errors.phone ? 'error' : ''}`}
          />
          {this.state.errors.phone && (!isSaved || this.isEditingTenant(saasTenant.saas_tenant_id!)) && (
            <span className='error-message'>{this.state.errors.phone}</span>
          )}
        </div>
        <div data-title='Israeli ID' className='input-and-error-container'>
          <input
            type='text'
            value={displayTenant.israeli_id || ''}
            onChange={(e) => {
              if (isSaved) {
                this.handleEditTenantChange(saasTenant.saas_tenant_id!, 'israeli_id', e.target.value);
              } else {
                this.handleNewTenantChange('israeli_id', e.target.value);
              }
            }}
            placeholder='Enter Israeli ID'
            className={`israeli-id ${this.state.errors.israeli_id ? 'error' : ''}`}
          />
          {this.state.errors.israeli_id && (!isSaved || this.isEditingTenant(saasTenant.saas_tenant_id!)) && (
            <span className='error-message'>{this.state.errors.israeli_id}</span>
          )}
        </div>
        <div data-title='Address' className='input-and-error-container'>
          <input
            type='text'
            value={displayTenant.address || ''}
            onChange={(e) => {
              if (isSaved) {
                this.handleEditTenantChange(saasTenant.saas_tenant_id!, 'address', e.target.value);
              } else {
                this.handleNewTenantChange('address', e.target.value);
              }
            }}
            placeholder='Enter Address'
            className={`address ${this.state.errors.address ? 'error' : ''}`}
          />
          {this.state.errors.address && (!isSaved || this.isEditingTenant(saasTenant.saas_tenant_id!)) && (
            <span className='error-message'>{this.state.errors.address}</span>
          )}
        </div>
        <div className='actions'>
          <div className='disabled' title='Disabled'>
            <input
              type='checkbox'
              checked={!!displayTenant.is_disabled}
              onChange={(e) => {
                if (isSaved) {
                  this.handleEditTenantChange(saasTenant.saas_tenant_id!, 'is_disabled', e.target.checked);
                } else {
                  this.handleNewTenantChange('is_disabled', e.target.checked);
                }
              }}
            />
          </div>
          {!isSaved ? (
            <>
              <button onClick={() => this.handleCreateRecord()} className='action-button save' title='Save'>
                <Save />
              </button>
              <button onClick={this.handleCancelNewTenant} className='action-button cancel' title='Cancel'>
                <Undo2 />
              </button>
            </>
          ) : this.state.editedTenants[saasTenant.saas_tenant_id!] ? (
            <>
              <button onClick={() => this.handleUpdateRecord(this.state.editedTenants[saasTenant.saas_tenant_id!])} className='action-button save' title='Save'>
                <Save />
              </button>
              <button onClick={() => this.handleCancelEdit(saasTenant.saas_tenant_id!)} className='action-button cancel' title='Cancel'>
                <Undo2 />
              </button>
            </>
          ) : (
            <button onClick={() => this.handleDeleteRecord(saasTenant.saas_tenant_id!)} className='action-button delete' title='Delete'>
              <Trash2 />
            </button>
          )}
        </div>
      </>
    );
  };

  /**
   * Validates a saasTenant
   * @param {Partial<ISaasTenant>} saasTenant - Tenant to validate
   * @returns {Record<string, string>} Validation errors
   */
  /**
   * Checks if a value already exists in the tenants list for a specific field
   * @param value - The value to check for duplicates
   * @param field - The field to check in each tenant
   * @param currentTenantId - The ID of the tenant being edited (to exclude from check)
   * @returns boolean - True if duplicate exists
   */
  private isDuplicate = (value: string, field: keyof ISaasTenant, currentTenantId?: string): boolean => {
    return this.props.saasTenants.some((tenant) => {
      // Skip comparing with the current record being edited
      if (currentTenantId && tenant.saas_tenant_id === currentTenantId) {
        return false;
      }
      // Compare with the actual or edited value of other records
      const compareValue = this.state.editedTenants[tenant.saas_tenant_id] ? this.state.editedTenants[tenant.saas_tenant_id][field] : tenant[field];
      return compareValue === value;
    });
  };

  validateTenant = (saasTenant: Partial<ISaasTenant>): Record<string, string> => {
    const errors: Record<string, string> = {};

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!saasTenant.saas_tenant_id) errors.saas_tenant_id = 'SaaS Tenant ID is required';
    else if (!uuidRegex.test(saasTenant.saas_tenant_id)) errors.saas_tenant_id = 'SaaS Tenant ID must be a valid UUID';
    else if (this.isDuplicate(saasTenant.saas_tenant_id, 'saas_tenant_id', saasTenant.saas_tenant_id)) {
      errors.saas_tenant_id = 'This SaaS Tenant ID is in use by another SaaS tenant';
    }

    if (!saasTenant.email) errors.email = 'Email is required';
    else if (!validateEmail(saasTenant.email)) errors.email = 'Invalid email address';
    else if (this.isDuplicate(saasTenant.email, 'email', saasTenant.saas_tenant_id)) {
      errors.email = 'This email is in use by another SaaS tenant';
    }

    if (!saasTenant.israeli_id) errors.israeli_id = 'Israeli ID is required';
    else if (!validateIsraeliId(saasTenant.israeli_id)) errors.israeli_id = 'Invalid Israeli ID';
    else if (this.isDuplicate(saasTenant.israeli_id, 'israeli_id', saasTenant.saas_tenant_id)) {
      errors.israeli_id = 'This Israeli ID is in use by another SaaS tenant';
    }

    if (!saasTenant.name) errors.name = 'Name is required';

    if (!saasTenant.address) errors.address = 'Address is required';

    if (!saasTenant.phone) errors.phone = 'Phone number is required';
    else if (!validateIsraeliPhone(saasTenant.phone)) errors.phone = 'Invalid phone number format (05X-XXX-XXXX)';
    else if (this.isDuplicate(saasTenant.phone, 'phone', saasTenant.saas_tenant_id)) {
      errors.phone = 'This phone number is in use by another SaaS tenant';
    }

    return errors;
  };

  isTenantValid = (saasTenant: INewSaasTenant): boolean => {
    const errors = this.validateTenant(saasTenant);
    this.setState({ errors });
    return Object.keys(errors).length === 0;
  };

  /**
   * Updates a specific field in the empty saasTenant state
   * @param {SaaSTenantField} field - Field to update
   * @param {boolean|string} value - New value for the field
   */
  handleNewTenantChange = (field: SaaSTenantField, value: boolean | string): void => {
    this.setState((prevState) => ({
      newSaaSTenant: {
        ...prevState.newSaaSTenant,
        [field]: value,
      },
    }));
  };

  /**
   * Creates a new saasTenant
   */
  handleCreateRecord = async (): Promise<void> => {
    const { newSaaSTenant } = this.state;
    if (!this.isTenantValid(newSaaSTenant)) return;

    // Prepare and dispatch create command
    this.props.addSaasTenantAction({ ...newSaaSTenant, created_at: new Date().toISOString(), onroute: true });
    this.props.prepareCreateSaasTenantCommandAction(newSaaSTenant);

    // Reset state
    this.setState({
      showNewSaaSTenant: false,
      newSaaSTenant: this.createInitialTenant(),
    });
  };

  /**
   * Updates an existing saasTenant
   * @param {ISaasTenant} saasTenant - The saasTenant to update
   */
  handleEditTenantChange = (tenantId: string, field: keyof ISaasTenant, value: any): void => {
    this.setState((prevState) => ({
      editedTenants: {
        ...prevState.editedTenants,
        [tenantId]: {
          ...(prevState.editedTenants[tenantId] || this.props.saasTenants.find((t) => t.saas_tenant_id === tenantId)!),
          [field]: value,
        },
      },
    }));
  };

  /**
   * Cancels the creation of a new tenant and resets the form
   */
  /**
   * Checks if a tenant is currently being edited
   * @param {string} tenantId - ID of the tenant to check
   * @returns {boolean} True if the tenant is being edited
   */
  isEditingTenant = (tenantId: string): boolean => {
    return Boolean(this.state.editedTenants[tenantId]);
  };

  handleCancelNewTenant = (): void => {
    this.setState({
      showNewSaaSTenant: false,
      newSaaSTenant: this.createInitialTenant(),
    });
  };

  /**
   * Cancels the editing of an existing tenant and reverts changes
   * @param {string} tenantId - ID of the tenant being edited
   */
  handleCancelEdit = (tenantId: string): void => {
    this.setState((prevState) => {
      const { [tenantId]: _, ...rest } = prevState.editedTenants;
      return { editedTenants: rest };
    });
  };

  handleUpdateRecord = async (saasTenant: ISaasTenant): Promise<void> => {
    // Clear any validation errors
    this.setState({ errors: {} });

    // Validate the tenant before updating
    const errors = this.validateTenant(saasTenant);
    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    // Update the tenant
    this.props.prepareUpdateSaasTenantCommandAction(saasTenant);
    this.props.updateSaasTenantAction({ ...saasTenant, onroute: true });

    // Clear the edited state for this tenant
    this.handleCancelEdit(saasTenant.saas_tenant_id);
  };

  /**
   * Deletes a saasTenant
   * @param {string} tenantId - ID of the saasTenant to delete
   */
  private handleDeleteRecord = async (tenantId: string): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this SaaS tenant?')) {
      this.props.prepareDeleteSaasTenantCommandAction(tenantId);
      this.props.deleteSaasTenantAction(tenantId);
    }
  };
}

// Type-safe field names for ISaasTenant
type SaaSTenantField = keyof INewSaasTenant;

interface ISaaSTenantsState {
  showNewSaaSTenant: boolean;
  newSaaSTenant: INewSaasTenant;
  editedTenants: Record<string, ISaasTenant>;
  errors: Record<string, string>;
}

/**
 * Props interface for SaaSTenants component
 * @interface ISaaSTenantsProps
 */
interface ISaaSTenantsProps {
  saasTenants: ISaasTenant[];
  prepareCreateSaasTenantCommandAction: typeof prepareCreateSaasTenantCommandAction;
  addSaasTenantAction: typeof addSaasTenantAction;
  prepareUpdateSaasTenantCommandAction: typeof prepareUpdateSaasTenantCommandAction;
  updateSaasTenantAction: typeof updateSaasTenantAction;
  prepareDeleteSaasTenantCommandAction: typeof prepareDeleteSaasTenantCommandAction;
  deleteSaasTenantAction: typeof deleteSaasTenantAction;
  userType: UserType;
  userId: string;
  userName: string;
  email: string;
}

// Maps Redux state to component props
const mapStateToProps = (state: IAppState): Pick<ISaaSTenantsProps, 'saasTenants' | 'userType' | 'userId' | 'userName' | 'email'> => ({
  saasTenants: state.saasTenants.saasTenants,
  userType: state.auth.userType,
  userId: state.auth.userId as string,
  userName: state.auth.userName as string,
  email: state.auth.email as string,
});

// Map Redux actions to component props
const mapDispatchToProps = {
  prepareCreateSaasTenantCommandAction,
  addSaasTenantAction,
  prepareUpdateSaasTenantCommandAction,
  updateSaasTenantAction,
  prepareDeleteSaasTenantCommandAction,
  deleteSaasTenantAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(SaaSTenants);
