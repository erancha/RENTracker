import {
  SET_SAAS_TENANTS,
  ISetSaasTenantsAction,
  ADD_SAAS_TENANT,
  IAddSaasTenantAction,
  UPDATE_SAAS_TENANT,
  IUpdateSaasTenantAction,
  DELETE_SAAS_TENANT,
  IDeleteSaasTenantAction,
  SET_SAAS_TENANT_CONFIRMED_BY_BACKEND,
  ISetSaasTenantConfirmedByBackendAction,
  CLEAR_SAAS_TENANTS,
  IClearSaasTenantsAction,
  INewSaasTenant,
  ISaasTenant,
  ICreateSaasTenantParams,
} from './types';
import { CommandSubject } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareUpdateCommandAction, prepareDeleteCommandAction } from '../crud/actions';

// CRUD operations
export const prepareCreateSaasTenantCommandAction = (saasTenant: INewSaasTenant) =>
  prepareCreateCommandAction({
    type: 'saasTenants' as CommandSubject,
    params: saasTenant as ICreateSaasTenantParams,
  });

export const prepareReadSaasTenantsCommandAction = () =>
  prepareReadCommandAction({
    type: 'saasTenants' as CommandSubject,
    params: {},
  });

export const prepareUpdateSaasTenantCommandAction = (saasTenant: INewSaasTenant) =>
  prepareUpdateCommandAction({
    type: 'saasTenants' as CommandSubject,
    params: saasTenant,
  });

export const prepareDeleteSaasTenantCommandAction = (saas_tenant_id: string) =>
  prepareDeleteCommandAction({
    type: 'saasTenants' as CommandSubject,
    params: { saas_tenant_id },
  });

export const setSaasTenantConfirmedByBackendAction = (saas_tenant_id: string, updated_at: string): ISetSaasTenantConfirmedByBackendAction => ({
  type: SET_SAAS_TENANT_CONFIRMED_BY_BACKEND,
  saas_tenant_id,
  updated_at,
});

// Regular actions
export const setSaasTenantsAction = (saasTenants: ISaasTenant[]): ISetSaasTenantsAction => ({
  type: SET_SAAS_TENANTS,
  payload: saasTenants,
});

export const addSaasTenantAction = (saasTenant: ISaasTenant): IAddSaasTenantAction => ({
  type: ADD_SAAS_TENANT,
  payload: saasTenant,
});

export const updateSaasTenantAction = (saasTenant: ISaasTenant): IUpdateSaasTenantAction => ({
  type: UPDATE_SAAS_TENANT,
  payload: saasTenant,
});

export const deleteSaasTenantAction = (saas_tenant_id: string): IDeleteSaasTenantAction => ({
  type: DELETE_SAAS_TENANT,
  payload: { saas_tenant_id },
});

export const clearSaasTenantsAction = (): IClearSaasTenantsAction => ({
  type: CLEAR_SAAS_TENANTS,
});
