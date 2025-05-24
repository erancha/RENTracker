import { IApartmentsState } from './types';
import initialState from '../store/initialState';
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
  ApartmentActionTypes,
} from './types';

// Reducer function for managing apartment state
export const apartmentsReducer = (state: IApartmentsState = initialState.apartments, action: ApartmentActionTypes): IApartmentsState => {
  switch (action.type) {
    case SET_NO_APARTMENTS_NOTIFIED:
      // Update noApartmentsNotified flag
      return {
        ...state,
        noApartmentsNotified: action.payload,
      };

    case ADD_APARTMENT:
      // Add new apartment to the beginning of the list
      return {
        ...state,
        apartments: [{ ...action.payload, updated_at: new Date().toISOString() }, ...state.apartments],
      };

    case SET_APARTMENTS:
      // Replace the list of apartments
      return {
        ...state,
        apartments: [...action.payload],
        currentApartmentId: action.payload.length > 0 ? action.payload[0].apartment_id : null,
      };

    case SET_CURRENT_APARTMENT:
      // Update the current apartment ID
      return {
        ...state,
        currentApartmentId: action.payload,
      };

    case SET_APARTMENT_CONFIRMED_BY_BACKEND:
      // Set apartment as no longer on route
      return {
        ...state,
        apartments: state.apartments.map((apartment) =>
          apartment.apartment_id === action.apartment_id ? { ...apartment, onroute: false, updated_at: action.updated_at } : apartment
        ),
      };

    case SET_APARTMENT_STATE:
      // Find the apartment to update
      const updatedApartment = state.apartments.find((apartment) => apartment.apartment_id === action.payload.apartment_id);
      if (!updatedApartment) {
        console.warn('Apartment not found when updating state', action.payload);
        return state;
      }

      return {
        ...state,
        apartments: [
          // Put updated apartment first to maintain descending updated_at order
          { ...updatedApartment, ...action.payload },
          ...state.apartments.filter((apartment) => apartment.apartment_id !== action.payload.apartment_id),
        ],
      };

    case DELETE_APARTMENT:
      // Remove apartment from the list
      const apartments = state.apartments.filter((apartment) => apartment.apartment_id !== action.payload);
      return {
        ...state,
        apartments,
        currentApartmentId: apartments[0]?.apartment_id || null,
      };

    case TOGGLE_APARTMENT_FORM:
      // Toggle apartment form visibility
      return {
        ...state,
        showApartmentForm: action.payload,
      };

    case UPDATE_APARTMENT_FIELD:
      // Update apartment form field
      return {
        ...state,
        apartmentForm: {
          ...state.apartmentForm,
          [action.payload.field]: action.payload.value,
          errors: {},
        },
      };

    case SET_APARTMENT_FORM_ERRORS:
      // Update apartment form errors
      return {
        ...state,
        apartmentForm: {
          ...state.apartmentForm,
          errors: action.payload,
        },
      };

    case RESET_APARTMENT_FORM:
      // Reset apartment form to initial state
      return {
        ...state,
        apartmentForm: initialState.apartments.apartmentForm,
      };

    default:
      // Return state unchanged for unknown actions
      return state;
  }
};
