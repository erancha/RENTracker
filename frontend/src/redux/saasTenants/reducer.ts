import {
  SET_SAAS_TENANTS,
  ISetSaasTenantsAction,
  ADD_SAAS_TENANT,
  IAddSaasTenantAction,
  UPDATE_SAAS_TENANT,
  IUpdateSaasTenantAction,
  DELETE_SAAS_TENANT,
  IDeleteSaasTenantAction,
  CLEAR_SAAS_TENANTS,
  IClearSaasTenantsAction,
  ISaasTenantsState,
  SET_SAAS_TENANT_CONFIRMED_BY_BACKEND,
  ISetSaasTenantConfirmedByBackendAction,
} from './types';
import initialState from '../store/initialState';

type HandledActions =
  | ISetSaasTenantsAction
  | IAddSaasTenantAction
  | ISetSaasTenantConfirmedByBackendAction
  | IUpdateSaasTenantAction
  | IDeleteSaasTenantAction
  | IClearSaasTenantsAction;

export const saasTenantsReducer = (state: ISaasTenantsState = initialState.saasTenants, action: HandledActions): ISaasTenantsState => {
  switch (action.type) {
    // Set saasTenants data
    case SET_SAAS_TENANTS:
      return {
        ...state,
        saasTenants: action.payload,
      };

    // Add a saasTenant
    case ADD_SAAS_TENANT:
      return {
        ...state,
        saasTenants: [action.payload, ...state.saasTenants],
      };

    case SET_SAAS_TENANT_CONFIRMED_BY_BACKEND:
      // Set apartment as no longer on route and move to start of array
      return {
        ...state,
        saasTenants: [
          ...state.saasTenants
            .filter((saasTenant) => saasTenant.saas_tenant_id === action.saas_tenant_id)
            .map((saasTenant) => ({ ...saasTenant, onroute: false, updated_at: action.updated_at })),
          ...state.saasTenants.filter((saasTenant) => saasTenant.saas_tenant_id !== action.saas_tenant_id)
        ],
      };

    // Update a saasTenant
    case UPDATE_SAAS_TENANT:
      return {
        ...state,
        saasTenants: state.saasTenants.map((saasTenant) =>
          saasTenant.saas_tenant_id === action.payload.saas_tenant_id ? action.payload : saasTenant
        ),
      };

    // Delete saasTenant
    case DELETE_SAAS_TENANT:
      return {
        ...state,
        saasTenants: state.saasTenants.filter((saasTenant) => saasTenant.saas_tenant_id !== action.payload.saas_tenant_id),
      };

    // Clear saasTenants
    case CLEAR_SAAS_TENANTS:
      return {
        ...state,
        saasTenants: [],
      };

    default:
      return state;
  }
};
