import initialState from 'redux/store/initialState';
import { PREPARE_CREATE_COMMAND, PREPARE_READ_COMMAND, PREPARE_UPDATE_COMMAND, PREPARE_DELETE_COMMAND, CrudActionTypes, ICrudState } from './types';

export const crudReducer = (state: ICrudState = initialState.crud, action: CrudActionTypes): ICrudState => {
  switch (action.type) {
    case PREPARE_CREATE_COMMAND:
      return {
        ...state,
        createCommand: action.payload,
      };

    case PREPARE_READ_COMMAND:
      return {
        ...state,
        readCommand: action.payload,
      };

    case PREPARE_UPDATE_COMMAND:
      return {
        ...state,
        updateCommand: action.payload,
      };

    case PREPARE_DELETE_COMMAND:
      return {
        ...state,
        deleteCommand: action.payload,
      };

    default:
      return state;
  }
};
