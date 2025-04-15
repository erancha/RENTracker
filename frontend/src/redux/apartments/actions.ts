import { Dispatch } from 'redux';
import { IApartment } from './types';
import { CommandType } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareUpdateCommandAction, prepareDeleteCommandAction } from '../crud/actions';
import {
  SET_NO_APARTMENTS_NOTIFIED,
  ADD_APARTMENT,
  SET_APARTMENTS,
  SET_CURRENT_APARTMENT,
  SET_APARTMENT_CONFIRMED_BY_BACKEND,
  SET_APARTMENT_STATE,
  DELETE_APARTMENT,
  TOGGLE_APARTMENT_FORM,
  UPDATE_APARTMENT_FIELD,
  SET_APARTMENT_FORM_ERRORS,
  RESET_APARTMENT_FORM,
  ICreateApartmentParams,
  ISetNoApartmentsNotifiedAction,
  IAddApartmentAction,
  ISetApartmentsAction,
  ISetCurrentApartmentAction,
  ISetApartmentConfirmedByBackendAction,
  ISetApartmentStateAction,
  IDeleteApartmentAction,
  IToggleApartmentFormAction,
  IUpdateApartmentFieldAction,
  ISetApartmentFormErrorsAction,
  IResetApartmentFormAction,
} from './types';

export const setNoApartmentsNotifiedAction = (notified: boolean): ISetNoApartmentsNotifiedAction => ({
  type: SET_NO_APARTMENTS_NOTIFIED,
  payload: notified,
});

// Apartment-specific action creators
export const prepareCreateApartmentCommandAction = (apartment_id: string, address: string, unit_number: string, rooms_count: number, rent_amount: number) =>
  prepareCreateCommandAction({
    type: 'apartments' as CommandType,
    params: {
      apartment_id,
      address,
      unit_number,
      rooms_count,
      rent_amount,
    } as ICreateApartmentParams,
  });

export const addApartmentAction = (apartment: IApartment): IAddApartmentAction => ({
  type: ADD_APARTMENT,
  payload: apartment,
});

export const prepareReadApartmentsCommandAction = () =>
  prepareReadCommandAction({
    type: 'apartments' as CommandType,
    params: {},
  });

export const setApartmentsAction = (apartments: IApartment[]): ISetApartmentsAction => ({
  type: SET_APARTMENTS,
  payload: apartments,
});

export const setCurrentApartmentAction = (apartment_id: string) => (dispatch: Dispatch) => {
  const action: ISetCurrentApartmentAction = {
    type: SET_CURRENT_APARTMENT,
    payload: apartment_id,
  };
  dispatch(action);
};

export const setApartmentConfirmedByBackendAction = (apartment_id: string, updated_at: string): ISetApartmentConfirmedByBackendAction => ({
  type: SET_APARTMENT_CONFIRMED_BY_BACKEND,
  apartment_id,
  updated_at,
});

export const prepareUpdateApartmentCommandAction = (apartment_id: string, updates: Partial<IApartment>) =>
  prepareUpdateCommandAction({
    type: 'apartments' as CommandType,
    params: {
      apartment_id: apartment_id,
      ...updates,
    },
  });

export const setApartmentStateAction = (update: Partial<IApartment> & { apartment_id: string }): ISetApartmentStateAction => ({
  type: SET_APARTMENT_STATE,
  payload: update,
});

export const prepareDeleteApartmentCommandAction = (apartment_id: string) =>
  prepareDeleteCommandAction({
    type: 'apartments' as CommandType,
    params: { apartment_id: apartment_id },
  });

export const deleteApartmentAction = (apartment_id: string): IDeleteApartmentAction => ({
  type: DELETE_APARTMENT,
  payload: apartment_id,
});

// Form management action creators
export const toggleApartmentFormAction = (show: boolean): IToggleApartmentFormAction => ({
  type: TOGGLE_APARTMENT_FORM,
  payload: show,
});

export const updateApartmentFieldAction = (field: string, value: string | number | boolean): IUpdateApartmentFieldAction => ({
  type: UPDATE_APARTMENT_FIELD,
  payload: { field, value },
});

export const setApartmentFormErrorsAction = (errors: Record<string, string>): ISetApartmentFormErrorsAction => ({
  type: SET_APARTMENT_FORM_ERRORS,
  payload: errors,
});

export const resetApartmentFormAction = (): IResetApartmentFormAction => ({
  type: RESET_APARTMENT_FORM,
});
