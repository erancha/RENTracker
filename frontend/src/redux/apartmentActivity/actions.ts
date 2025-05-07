import {
  DELETE_APARTMENT_ACTIVITY,
  IDeleteApartmentActivityAction,
  SET_APARTMENT_ACTIVITY,
  ISetApartmentActivityAction,
  ADD_APARTMENT_ACTIVITY,
  IAddApartmentActivityAction,
  SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  ISetApartmentActivityConfirmedByBackendAction,
  CLEAR_APARTMENT_ACTIVITY,
  INewApartmentActivity,
  IApartmentActivity,
  ICreateApartmentActivityParams,
  IClearApartmentActivityAction,
} from './types';
import { CommandSubject } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareDeleteCommandAction } from '../crud/actions';

// CRUD operations
export const prepareCreateApartmentActivityCommandAction = (activity: INewApartmentActivity) =>
  prepareCreateCommandAction({
    type: 'apartmentActivity' as CommandSubject,
    params: activity as ICreateApartmentActivityParams,
  });

export const prepareReadApartmentActivityCommandAction = (apartment_id: string) =>
  prepareReadCommandAction({
    type: 'apartmentActivity' as CommandSubject,
    params: { apartment_id },
  });

export const prepareDeleteApartmentActivityCommandAction = (activity_id: string) =>
  prepareDeleteCommandAction({
    type: 'apartmentActivity' as CommandSubject,
    params: { activity_id },
  });

// Regular actions
export const setApartmentActivityAction = (apartmentId: string, activity: IApartmentActivity[]): ISetApartmentActivityAction => ({
  type: SET_APARTMENT_ACTIVITY,
  payload: { apartmentId, activity },
});

export const addApartmentActivityAction = (activity: IApartmentActivity): IAddApartmentActivityAction => ({
  type: ADD_APARTMENT_ACTIVITY,
  payload: activity,
});

export const deleteApartmentActivityAction = (apartmentId: string, activityId: string): IDeleteApartmentActivityAction => ({
  type: DELETE_APARTMENT_ACTIVITY,
  payload: { apartmentId, activityId },
});

export const setApartmentActivityConfirmedByBackendAction = (apartmentId: string, activityId: string): ISetApartmentActivityConfirmedByBackendAction => ({
  type: SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  payload: { apartmentId, activityId },
});

export const clearApartmentActivityAction = (): IClearApartmentActivityAction => ({
  type: CLEAR_APARTMENT_ACTIVITY,
});
