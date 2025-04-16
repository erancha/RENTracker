// Reducers
import { ActivityState } from './types';
import initialState from '../store/initialState';
import {
  SET_ACTIVITY,
  ISetActivityAction,
  ADD_ACTIVITY,
  IAddActivityAction,
  SET_ACTIVITY_CONFIRMED_BY_BACKEND,
  ISetActivityConfirmedByBackendAction,
  CLEAR_ACTIVITY,
  IClearActivityAction,
} from './actions';

type HandledActions = ISetActivityAction | IAddActivityAction | ISetActivityConfirmedByBackendAction | IClearActivityAction;

export const activityReducer = (state: ActivityState = initialState.activity, action: HandledActions): ActivityState => {
  switch (action.type) {
    // Set activity data.
    case SET_ACTIVITY:
      return {
        ...state,
        activity: action.payload,
      };

    // Add a activity.
    case ADD_ACTIVITY: {
      return {
        ...state,
        activity: [action.payload, ...state.activity],
      };
    }

    // Set activity as onroute
    case SET_ACTIVITY_CONFIRMED_BY_BACKEND: {
      return {
        ...state,
        activity: state.activity.map((activity) => (activity.activity_id === action.payload ? { ...activity, onroute: false } : activity)),
      };
    }

    // Clear all activity
    case CLEAR_ACTIVITY: {
      return {
        ...state,
        activity: [],
      };
    }

    default:
      return state;
  }
};
