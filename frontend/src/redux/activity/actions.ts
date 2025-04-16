import { IActivity, ICreateActivityParams, INewActivity } from './types';
import { CommandType } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareUpdateCommandAction } from '../crud/actions';

// Activity-specific action types
export const SET_ACTIVITY = 'SET_ACTIVITY';
export const ADD_ACTIVITY = 'ADD_ACTIVITY';
export const SET_ACTIVITY_CONFIRMED_BY_BACKEND = 'SET_ACTIVITY_CONFIRMED_BY_BACKEND';
export const CLEAR_ACTIVITY = 'CLEAR_ACTIVITY';

// Activity-specific action interfaces
export interface ISetActivityAction {
  type: typeof SET_ACTIVITY;
  payload: IActivity[];
}

export interface IAddActivityAction {
  type: typeof ADD_ACTIVITY;
  payload: IActivity;
}

export interface ISetActivityConfirmedByBackendAction {
  type: typeof SET_ACTIVITY_CONFIRMED_BY_BACKEND;
  payload: string; // activity id
}

export interface IClearActivityAction {
  type: typeof CLEAR_ACTIVITY;
}

// CRUD operations
export const prepareCreateActivityCommandAction = (activity: INewActivity) =>
  prepareCreateCommandAction({
    type: 'activity' as CommandType,
    params: activity as ICreateActivityParams,
  });

export const prepareReadActivityCommandAction = (apartment_id: string) =>
  prepareReadCommandAction({
    type: 'activity' as CommandType,
    params: { apartment_id },
  });

export const prepareUpdateActivityCommandAction = (activityId: string, updates: Partial<IActivity>) =>
  prepareUpdateCommandAction({
    type: 'activity' as CommandType,
    params: {
      id: activityId,
      ...updates,
    },
  });

// Regular actions
export const setActivityAction = (activity: IActivity[]): ISetActivityAction => ({
  type: SET_ACTIVITY,
  payload: activity,
});

export const addActivityAction = (activity: IActivity): IAddActivityAction => ({
  type: ADD_ACTIVITY,
  payload: activity,
});

export const setActivityConfirmedByBackendAction = (activityId: string): ISetActivityConfirmedByBackendAction => ({
  type: SET_ACTIVITY_CONFIRMED_BY_BACKEND,
  payload: activityId,
});

export const clearActivityAction = (): IClearActivityAction => ({
  type: CLEAR_ACTIVITY,
});
