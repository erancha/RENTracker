import { IOnRoute } from '../crud/types';

/**
 * Represents a SaaS tenant in the system.
 * Used as the data payload when creating/updating a tenant.
 */
export interface INewSaasTenant {
  saas_tenant_id: string; // Unique identifier for the tenant
  is_disabled: boolean; // If disabled, the landlord account is no longer active
}

/**
 * Represents a SaaS tenant as stored in the Redux state.
 * Extends INewSaasTenant to include on route status and created_at timestamp.
 */
export interface ISaasTenant extends INewSaasTenant, IOnRoute {
  created_at?: string; // ISO string timestamp when the tenant was created
  updated_at?: string; // ISO string timestamp when the tenant was updated
}

// SaasTenant CRUD params
export interface ICreateSaasTenantParams extends INewSaasTenant {}

export interface IReadSaasTenantParams {}

export const SET_SAAS_TENANT_CONFIRMED_BY_BACKEND = 'SET_SAAS_TENANT_CONFIRMED_BY_BACKEND';
export interface ISetSaasTenantConfirmedByBackendAction {
  type: typeof SET_SAAS_TENANT_CONFIRMED_BY_BACKEND;
  saas_tenant_id: string;
  updated_at: string;
}

// SaasTenant-specific action types
export const SET_SAAS_TENANTS = 'SET_SAAS_TENANTS';
export const ADD_SAAS_TENANT = 'ADD_SAAS_TENANT';
export const UPDATE_SAAS_TENANT = 'UPDATE_SAAS_TENANT';
export const DELETE_SAAS_TENANT = 'DELETE_SAAS_TENANT';
export const CLEAR_SAAS_TENANTS = 'CLEAR_SAAS_TENANTS';

// SaasTenant-specific action interfaces
export interface ISetSaasTenantsAction {
  type: typeof SET_SAAS_TENANTS;
  payload: ISaasTenant[];
}

export interface IAddSaasTenantAction {
  type: typeof ADD_SAAS_TENANT;
  payload: ISaasTenant;
}

export interface IUpdateSaasTenantAction {
  type: typeof UPDATE_SAAS_TENANT;
  payload: ISaasTenant;
}

export interface IDeleteSaasTenantAction {
  type: typeof DELETE_SAAS_TENANT;
  payload: {
    saas_tenant_id: string;
  };
}

export interface IClearSaasTenantsAction {
  type: typeof CLEAR_SAAS_TENANTS;
}

export interface ISaasTenantsState {
  saasTenants: ISaasTenant[];
}

export type SaasTenantsActionTypes =
  | ISetSaasTenantsAction
  | IAddSaasTenantAction
  | IUpdateSaasTenantAction
  | IDeleteSaasTenantAction
  | IClearSaasTenantsAction
  | ISetSaasTenantConfirmedByBackendAction;
