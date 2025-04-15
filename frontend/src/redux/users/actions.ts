import { Dispatch } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { Action } from 'redux';
import { RootState } from '../store/store';
import { getAllUsers } from '../../services/rest';
import { FETCH_USERS_REQUEST, FETCH_USERS_SUCCESS, FETCH_USERS_FAILURE } from './types';

// Redux Thunk middleware type that defines an async action creator:
// - Returns void (no return value)
// - Has access to the full Redux state (RootState)
// - No extra argument (unknown)
// - Can dispatch basic Redux actions (Action<string>)
export const fetchUsers =
  (JWT: string): ThunkAction<void, RootState, unknown, Action<string>> =>
  async (dispatch: Dispatch) => {
    dispatch({ type: FETCH_USERS_REQUEST });

    try {
      const users = await getAllUsers(JWT);
      dispatch({
        type: FETCH_USERS_SUCCESS,
        payload: users,
      });
    } catch (error) {
      dispatch({
        type: FETCH_USERS_FAILURE,
        payload: error instanceof Error ? error.message : 'An error occurred while fetching users',
      });
    }
  };
