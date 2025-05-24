import { IOnRoute } from '../crud/types';

export interface IApartmentsState {
  apartments: IApartment[];
  currentApartmentId: string | null;
  noApartmentsNotified: boolean;
  showApartmentForm: boolean;
  apartmentForm: {
    id: string;
    address: string;
    is_housing_unit: boolean;
    unit_number: string;
    rooms_count: number;
    rent_amount: number;
    is_disabled: boolean;
    errors: Record<string, string>;
  };
}

/**
 * Represents an apartment.
 * Extends ICreateApartmentParams to include on route status, disabled status, and user ID.
 */
export interface IApartment extends IOnRoute {
  apartment_id: string;
  user_id: string;
  address: string;
  is_housing_unit: boolean;
  unit_number: string;
  rooms_count: number;
  rent_amount: number;
  updated_at?: string;
  is_disabled: boolean;
}

export type ICreateApartmentParams = Pick<IApartment, 'apartment_id' | 'address' | 'unit_number' | 'rooms_count' | 'rent_amount'>;

// Takes required apartment_id from IApartment
// Takes the rest of the fields from ICreateApartmentParams (except apartment_id) and adds is_disabled
// Makes all those fields optional with Partial
// This ensures:
//    apartment_id is always required
//    All other fields are optional
export type IUpdateApartmentParams = Pick<IApartment, 'apartment_id'> & Partial<Omit<ICreateApartmentParams, 'apartment_id'> & Pick<IApartment, 'is_disabled'>>;

// Apartment-specific action types
export const SET_NO_APARTMENTS_NOTIFIED = 'SET_NO_APARTMENTS_NOTIFIED';
export const ADD_APARTMENT = 'ADD_APARTMENT';
export const SET_APARTMENTS = 'SET_APARTMENTS';
export const SET_CURRENT_APARTMENT = 'SET_CURRENT_APARTMENT';
export const SET_APARTMENT_CONFIRMED_BY_BACKEND = 'SET_APARTMENT_CONFIRMED_BY_BACKEND';
export const SET_APARTMENT_STATE = 'SET_APARTMENT_STATE';
export const DELETE_APARTMENT = 'DELETE_APARTMENT';

// Form-specific action types
export const TOGGLE_APARTMENT_FORM = 'TOGGLE_APARTMENT_FORM';
export const UPDATE_APARTMENT_FIELD = 'UPDATE_APARTMENT_FIELD';
export const SET_APARTMENT_FORM_ERRORS = 'SET_APARTMENT_FORM_ERRORS';
export const RESET_APARTMENT_FORM = 'RESET_APARTMENT_FORM';

export interface ISetNoApartmentsNotifiedAction {
  type: typeof SET_NO_APARTMENTS_NOTIFIED;
  payload: boolean;
}

// Apartment-specific action interfaces
export interface IAddApartmentAction {
  type: typeof ADD_APARTMENT;
  payload: IApartment;
}

export interface ISetApartmentsAction {
  type: typeof SET_APARTMENTS;
  payload: IApartment[];
}

export interface ISetCurrentApartmentAction {
  type: typeof SET_CURRENT_APARTMENT;
  payload: string;
}

export interface ISetApartmentConfirmedByBackendAction {
  type: typeof SET_APARTMENT_CONFIRMED_BY_BACKEND;
  apartment_id: string;
  updated_at: string;
}

export interface ISetApartmentStateAction {
  type: typeof SET_APARTMENT_STATE;
  payload: Partial<IApartment> & { apartment_id: string };
}

export interface IDeleteApartmentAction {
  type: typeof DELETE_APARTMENT;
  payload: string;
}

// Form-specific action interfaces
export interface IToggleApartmentFormAction {
  type: typeof TOGGLE_APARTMENT_FORM;
  payload: boolean;
}

export interface IUpdateApartmentFieldAction {
  type: typeof UPDATE_APARTMENT_FIELD;
  payload: { field: string; value: string | number | boolean };
}

export interface ISetApartmentFormErrorsAction {
  type: typeof SET_APARTMENT_FORM_ERRORS;
  payload: Record<string, string>;
}

export interface IResetApartmentFormAction {
  type: typeof RESET_APARTMENT_FORM;
}

export type ApartmentActionTypes =
  | ISetNoApartmentsNotifiedAction
  | IAddApartmentAction
  | ISetApartmentsAction
  | ISetCurrentApartmentAction
  | ISetApartmentConfirmedByBackendAction
  | ISetApartmentStateAction
  | IDeleteApartmentAction
  | IToggleApartmentFormAction
  | IUpdateApartmentFieldAction
  | ISetApartmentFormErrorsAction
  | IResetApartmentFormAction;
