import {
  ICreateApartmentActivityParams,
  DELETE_APARTMENT_APARTMENT_ACTIVITY,
  IDeleteApartmentActivityAction,
  IApartmentActivity,
  INewApartmentActivity,
  SET_APARTMENT_APARTMENT_ACTIVITY,
  ADD_APARTMENT_APARTMENT_ACTIVITY,
  SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  CLEAR_APARTMENT_ACTIVITY,
} from './types';
import { CommandType } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareDeleteCommandAction } from '../crud/actions';

// ApartmentActivity-specific action interfaces
export interface ISetApartmentActivityAction {
  type: typeof SET_APARTMENT_APARTMENT_ACTIVITY;
  payload: IApartmentActivity[];
}

export interface IAddApartmentActivityAction {
  type: typeof ADD_APARTMENT_APARTMENT_ACTIVITY;
  payload: IApartmentActivity;
}

export interface ISetApartmentActivityConfirmedByBackendAction {
  type: typeof SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND;
  payload: string; // activity id
}

export interface IClearApartmentActivityAction {
  type: typeof CLEAR_APARTMENT_ACTIVITY;
}

// CRUD operations
export const prepareCreateApartmentActivityCommandAction = (activity: INewApartmentActivity) =>
  prepareCreateCommandAction({
    type: 'apartmentActivity' as CommandType,
    params: activity as ICreateApartmentActivityParams,
  });

export const prepareReadApartmentActivityCommandAction = (apartment_id: string) =>
  prepareReadCommandAction({
    type: 'apartmentActivity' as CommandType,
    params: { apartment_id },
  });

export const prepareDeleteApartmentActivityCommandAction = (activity_id: string) =>
  prepareDeleteCommandAction({
    type: 'apartmentActivity' as CommandType,
    params: { activity_id },
  });

// Regular actions
export const setApartmentActivityAction = (activity: IApartmentActivity[]): ISetApartmentActivityAction => ({
  type: SET_APARTMENT_APARTMENT_ACTIVITY,
  payload: activity,
});

export const addApartmentActivityAction = (activity: IApartmentActivity): IAddApartmentActivityAction => ({
  type: ADD_APARTMENT_APARTMENT_ACTIVITY,
  payload: activity,
});

export const deleteApartmentActivityAction = (activity_id: string): IDeleteApartmentActivityAction => ({
  type: DELETE_APARTMENT_APARTMENT_ACTIVITY,
  payload: activity_id,
});

export const setApartmentActivityConfirmedByBackendAction = (activityId: string): ISetApartmentActivityConfirmedByBackendAction => ({
  type: SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  payload: activityId,
});

export const clearApartmentActivityAction = (): IClearApartmentActivityAction => ({
  type: CLEAR_APARTMENT_ACTIVITY,
});
