// Reducers
import {
  IApartmentActivityState,
  ADD_APARTMENT_APARTMENT_ACTIVITY,
  CLEAR_APARTMENT_ACTIVITY,
  DELETE_APARTMENT_APARTMENT_ACTIVITY,
  IDeleteApartmentActivityAction,
  SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND,
  SET_APARTMENT_APARTMENT_ACTIVITY,
} from './types';
import initialState from '../store/initialState';
import {
  ISetApartmentActivityAction,
  IAddApartmentActivityAction,
  ISetApartmentActivityConfirmedByBackendAction,
  IClearApartmentActivityAction,
} from './actions';

type HandledActions =
  | ISetApartmentActivityAction
  | IAddApartmentActivityAction
  | ISetApartmentActivityConfirmedByBackendAction
  | IClearApartmentActivityAction
  | IDeleteApartmentActivityAction;

export const apartmentActivityReducer = (state: IApartmentActivityState = initialState.apartmentActivity, action: HandledActions): IApartmentActivityState => {
  switch (action.type) {
    // Set activity data.
    case SET_APARTMENT_APARTMENT_ACTIVITY:
      return {
        ...state,
        activity: action.payload,
      };

    // Add a activity.
    case ADD_APARTMENT_APARTMENT_ACTIVITY: {
      return {
        ...state,
        activity: [action.payload, ...state.activity],
      };
    }

    // Delete activity
    case DELETE_APARTMENT_APARTMENT_ACTIVITY: {
      // Remove activity from the list
      return {
        ...state,
        activity: state.activity.filter((activity) => activity.activity_id !== action.payload),
      };
    }

    // Set activity as onroute
    case SET_APARTMENT_ACTIVITY_CONFIRMED_BY_BACKEND: {
      return {
        ...state,
        activity: state.activity.map((activity) => (activity.activity_id === action.payload ? { ...activity, onroute: false } : activity)),
      };
    }

    // Clear all activity
    case CLEAR_APARTMENT_ACTIVITY: {
      return {
        ...state,
        activity: [],
      };
    }

    default:
      return state;
  }
};
