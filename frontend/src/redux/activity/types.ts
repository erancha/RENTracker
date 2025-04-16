import { IOnRoute } from '../store/types';

/**
 * Represents a new activity to be sent to the backend.
 * Used as the data payload when uploading a activity.
 */
export interface INewActivity {
  activity_id: string; // Unique identifier for the activity
  apartment_id: string; // Source apartment ID
  description: string; // Description of the activity
  pending_confirmation: boolean; // Indicates if the activity is pending confirmation
}

/**
 * Represents a activity as stored in the Redux state.
 * Extends INewActivity to include execution timestamp and on route status.
 */
export interface IActivity extends INewActivity, IOnRoute {
  created_at: string; // Timestamp when the activity was saved
}

// Activity CRUD params
export interface ICreateActivityParams extends INewActivity {}

export interface IReadActivityParams {
  apartment_id?: string;
}

// Activity-specific action types
export const SET_ACTIVITY = 'SET_ACTIVITY';
export const ADD_ACTIVITY = 'ADD_ACTIVITY';

// Activity-specific action interfaces
export interface ISetActivityAction {
  type: typeof SET_ACTIVITY;
  payload: IActivity[];
}

export interface IAddActivityAction {
  type: typeof ADD_ACTIVITY;
  payload: IActivity;
}

export type ActivityActionTypes = ISetActivityAction | IAddActivityAction;

export interface ActivityState {
  activity: IActivity[];
  analyticsData: any[];
}
