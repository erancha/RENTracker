import React from 'react';
import { connect } from 'react-redux';
import { IAppState } from '../redux/store/types';
import { ISaasTenant, INewSaasTenant } from '../redux/saasTenants/types';
import {
  prepareReadSaasTenantsCommandAction,
  prepareCreateSaasTenantCommandAction,
  addSaasTenantAction,
  prepareUpdateSaasTenantCommandAction,
  updateSaasTenantAction,
  prepareDeleteSaasTenantCommandAction,
  deleteSaasTenantAction,
} from '../redux/saasTenants/actions';
import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { timeShortDisplay } from 'utils/utils';

// Type-safe field names for ISaasTenant
type SaaSTenantField = keyof Pick<ISaasTenant, 'is_disabled' | 'saas_tenant_id'>;

/**
 * Component for managing and displaying SaaS tenants.
 * @class SaaSTenants
 * @extends React.Component<ISaaSTenantsProps, { showNewSaaSTenant: boolean, newSaaSTenant: INewSaasTenant }>
 */
class SaaSTenants extends React.Component<ISaaSTenantsProps, { showNewSaaSTenant: boolean; newSaaSTenant: INewSaasTenant; errors: Record<string, string> }> {
  /**
   * Creates an initial saasTenant with default values
   * @returns {INewSaasTenant} A new saasTenant with default values
   */
  private createInitialTenant = (): INewSaasTenant => ({
    saas_tenant_id: '',
    is_disabled: false,
  });

  constructor(props: ISaaSTenantsProps) {
    super(props);
    this.state = { showNewSaaSTenant: false, newSaaSTenant: this.createInitialTenant(), errors: {} };
  }

  componentDidMount() {
    this.props.prepareReadSaasTenantsCommandAction();
  }

  render(): React.ReactNode {
    const { tenants } = this.props;
    const { showNewSaaSTenant, newSaaSTenant } = this.state;

    return (
      <div className='page body-container saas-tenants'>
        <div className='header m-n-relation'>
          <span>SaaS Tenants</span>
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
        </div>

        <div className='saas-tenants-container'>
          <div className='table-header saas-tenant'>
            <div className='updated-at'>Updated At</div>
            <div className='saas-tenant-id'>Tenant ID</div>
            <div className='disabled'>Disabled</div>
            <div className='actions'>Actions</div>
          </div>

          <div className='data-container saas-tenant-list'>
            {showNewSaaSTenant && <div className='table-row saas-tenant input'>{this.renderTenant(newSaaSTenant)}</div>}

            {tenants.length > 0 ? (
              tenants.map((saasTenant, index) => (
                <div
                  key={saasTenant.saas_tenant_id}
                  tabIndex={index}
                  className={`table-row saas-tenant${saasTenant.onroute ? ' onroute' : ''}${saasTenant.is_disabled ? ' is_disabled' : ''}`}
                >
                  {this.renderTenant(saasTenant)}
                </div>
              ))
            ) : (
              <div className='empty-message'>No tenants found...</div>
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
  renderTenant = (saasTenant: Partial<ISaasTenant>) => {
    const isSaved = 'created_at' in saasTenant;

    return (
      <>
        <div data-title='Updated At'>{saasTenant.updated_at ? timeShortDisplay(new Date(saasTenant.updated_at)) : ''}</div>
        <div data-title='SaaS Tenant ID' className='input-and-error-container'>
          {isSaved ? (
            <span className='saas-tenant-id'>{saasTenant.saas_tenant_id}</span>
          ) : (
            <>
              <input
                type='text'
                value={saasTenant.saas_tenant_id || ''}
                onChange={(e) => this.handleNewTenantChange('saas_tenant_id', e.target.value)}
                placeholder='Enter SaaS Tenant ID'
                className={`saas-tenant-id ${this.state.errors.saas_tenant_id ? 'error' : ''}`}
              />
              {this.state.errors.saas_tenant_id && <span className='error-message'>{this.state.errors.saas_tenant_id}</span>}
            </>
          )}
        </div>
        <div className='disabled' data-title='Disabled'>
          <input
            type='checkbox'
            checked={!!saasTenant.is_disabled}
            onChange={(e) => {
              if (isSaved) {
                this.handleUpdateRecord({ ...(saasTenant as ISaasTenant), is_disabled: e.target.checked });
              } else {
                this.handleNewTenantChange('is_disabled', e.target.checked);
              }
            }}
          />
        </div>
        {!isSaved ? (
          <div className='actions'>
            <button onClick={() => this.handleCreateRecord()} className='action-button save' title='Save'>
              <Save />
            </button>
            <button onClick={this.handleCancel} className='action-button cancel' title='Cancel'>
              <Undo2 />
            </button>
          </div>
        ) : (
          <div className='actions'>
            <button onClick={() => this.handleDeleteRecord(saasTenant.saas_tenant_id as string)} className='action-button delete' title='Delete'>
              <Trash2 />
            </button>
          </div>
        )}
      </>
    );
  };

  /**
   * Validates a saasTenant before execution
   * @param {INewSaasTenant} saasTenant - Tenant to validate
   * @returns {boolean} Whether the saasTenant is valid
   */
  validateTenant = (saasTenant: INewSaasTenant): Record<string, string> => {
    const errors: Record<string, string> = {};

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!saasTenant.saas_tenant_id) {
      errors.saas_tenant_id = 'SaaS Tenant ID is required';
    } else if (!uuidRegex.test(saasTenant.saas_tenant_id)) {
      errors.saas_tenant_id = 'SaaS Tenant ID must be a valid UUID';
    } else if (this.props.tenants.some((tenant) => tenant.saas_tenant_id === saasTenant.saas_tenant_id)) {
      errors.saas_tenant_id = 'SaaS Tenant ID already exists';
    }

    return errors;
  };

  isTenantValid = (saasTenant: INewSaasTenant) => {
    const errors = this.validateTenant(saasTenant);
    this.setState({ errors });
    return Object.keys(errors).length === 0;
  };

  /**
   * Updates a specific field in the empty saasTenant state
   * @param {SaaSTenantField} field - Field to update
   * @param {boolean|string} value - New value for the field
   */
  handleNewTenantChange = (field: SaaSTenantField, value: boolean | string) => {
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
  private handleCreateRecord = async (): Promise<void> => {
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
  private handleUpdateRecord = async (saasTenant: ISaasTenant): Promise<void> => {
    this.props.prepareUpdateSaasTenantCommandAction(saasTenant);
    this.props.updateSaasTenantAction({ ...saasTenant, onroute: true });
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

  /**
   * Cancels the current saasTenant and resets the form
   */
  handleCancel = () => {
    this.setState({ showNewSaaSTenant: false, newSaaSTenant: this.createInitialTenant() });
  };
}

/**
 * Props interface for SaaSTenants component
 * @interface ISaaSTenantsProps
 */
interface ISaaSTenantsProps {
  tenants: ISaasTenant[];
  prepareReadSaasTenantsCommandAction: typeof prepareReadSaasTenantsCommandAction;
  prepareCreateSaasTenantCommandAction: typeof prepareCreateSaasTenantCommandAction;
  addSaasTenantAction: typeof addSaasTenantAction;
  prepareUpdateSaasTenantCommandAction: typeof prepareUpdateSaasTenantCommandAction;
  updateSaasTenantAction: typeof updateSaasTenantAction;
  prepareDeleteSaasTenantCommandAction: typeof prepareDeleteSaasTenantCommandAction;
  deleteSaasTenantAction: typeof deleteSaasTenantAction;
}

// Maps Redux state to component props
const mapStateToProps = (state: IAppState): Pick<ISaaSTenantsProps, 'tenants'> => ({
  tenants: state.saasTenants.saasTenants,
});

// Map Redux actions to component props
const mapDispatchToProps = {
  prepareReadSaasTenantsCommandAction,
  prepareCreateSaasTenantCommandAction,
  addSaasTenantAction,
  prepareUpdateSaasTenantCommandAction,
  updateSaasTenantAction,
  prepareDeleteSaasTenantCommandAction,
  deleteSaasTenantAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(SaaSTenants);
