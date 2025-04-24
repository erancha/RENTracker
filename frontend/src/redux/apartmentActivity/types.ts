import { IOnRoute } from '../crud/types';

/**
 * Represents a new activity to be sent to the backend.
 * Used as the data payload when uploading a activity.
 */
export interface INewApartmentActivity {
  activity_id: string; // Unique identifier for the activity
  apartment_id: string; // Source apartment ID
  description: string; // Description of the activity
  pending_confirmation: boolean; // Indicates if the activity is pending confirmation
}

/**
 * Represents a activity as stored in the Redux state.
 * Extends INewApartmentActivity to include execution timestamp and on route status.
 */
export interface IApartmentActivity extends INewApartmentActivity, IOnRoute {
  created_at: string; // Timestamp when the activity was saved
}

// ApartmentActivity CRUD params
export interface ICreateApartmentActivityParams extends INewApartmentActivity {}

export interface IReadApartmentActivityParams {
  apartment_id?: string;
}

// ApartmentActivity-specific action types
export const ADD_APARTMENT_ACTIVITY = 'ADD_APARTMENT_ACTIVITY';
export const SET_APARTMENT_ACTIVITY = 'SET_APARTMENT_ACTIVITY';
export const SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND = 'SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND';
export const DELETE_APARTMENT_ACTIVITY = 'DELETE_APARTMENT_ACTIVITY';
export const CLEAR_APARTMENT_ACTIVITY = 'CLEAR_APARTMENT_ACTIVITY';

// ApartmentActivity-specific action interfaces
export interface ISetApartmentActivityAction {
  type: typeof SET_APARTMENT_ACTIVITY;
  payload: {
    apartmentId: string;
    activity: IApartmentActivity[];
  };
}

export interface IAddApartmentActivityAction {
  type: typeof ADD_APARTMENT_ACTIVITY;
  payload: IApartmentActivity;
}

export interface IDeleteApartmentActivityAction {
  type: typeof DELETE_APARTMENT_ACTIVITY;
  payload: {
    apartmentId: string;
    activityId: string;
  };
}

export interface ISetApartmentActivityConfirmedByBackendAction {
  type: typeof SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND;
  payload: {
    apartmentId: string;
    activityId: string;
  };
}

export interface IClearApartmentActivityAction {
  type: typeof CLEAR_APARTMENT_ACTIVITY;
}

export interface IApartmentActivityState {
  activity: Record<string, IApartmentActivity[]>; // Group activities by apartmentId
}

// analyticsData: any[];
