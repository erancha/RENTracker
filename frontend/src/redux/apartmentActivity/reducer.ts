// Reducers
import {
  ADD_APARTMENT_ACTIVITY,
  IAddApartmentActivityAction,
  SET_APARTMENT_ACTIVITY,
  ISetApartmentActivityAction,
  SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  ISetApartmentActivityConfirmedByBackendAction,
  DELETE_APARTMENT_ACTIVITY,
  IDeleteApartmentActivityAction,
  CLEAR_APARTMENT_ACTIVITY,
  IClearApartmentActivityAction,
  IApartmentActivityState,
} from './types';
import initialState from '../store/initialState';

type HandledActions =
  | IAddApartmentActivityAction
  | ISetApartmentActivityAction
  | ISetApartmentActivityConfirmedByBackendAction
  | IDeleteApartmentActivityAction
  | IClearApartmentActivityAction;

export const apartmentActivityReducer = (state: IApartmentActivityState = initialState.apartmentActivity, action: HandledActions): IApartmentActivityState => {
  switch (action.type) {
    // Set activity data.
    case SET_APARTMENT_ACTIVITY: {
      const { apartmentId, activity } = action.payload;
      return {
        ...state,
        activity: {
          ...state.activity,
          [apartmentId]: activity,
        },
      };
    }

    // Add a activity.
    case ADD_APARTMENT_ACTIVITY: {
      const activity = action.payload;
      return {
        ...state,
        activity: {
          ...state.activity,
          [activity.apartment_id]: [activity, ...(state.activity[activity.apartment_id] || [])],
        },
      };
    }

    // Delete activity
    case DELETE_APARTMENT_ACTIVITY: {
      const { apartmentId, activityId } = action.payload;
      return {
        ...state,
        activity: {
          ...state.activity,
          [apartmentId]: state.activity[apartmentId]?.filter((activity) => activity.activity_id !== activityId) || [],
        },
      };
    }

    // Set activity as no longer on route
    case SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND: {
      const { apartmentId, activityId } = action.payload;
      return {
        ...state,
        activity: {
          ...state.activity,
          [apartmentId]:
            state.activity[apartmentId]?.map((activity) => (activity.activity_id === activityId ? { ...activity, onroute: false } : activity)) || [],
        },
      };
    }

    // Clear all activity
    case CLEAR_APARTMENT_ACTIVITY: {
      return {
        ...state,
        activity: {},
      };
    }

    default:
      return state;
  }
};
