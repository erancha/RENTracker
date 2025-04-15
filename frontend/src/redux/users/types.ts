export interface IUser {
  user_id: string;
  user_name: string;
  email_address: string;
  created_at: string;
}

export interface IUsersState {
  list: IUser[];
  loading: boolean;
  error: string | null;
}

// Action Types
export const FETCH_USERS_REQUEST = 'FETCH_USERS_REQUEST';
export const FETCH_USERS_SUCCESS = 'FETCH_USERS_SUCCESS';
export const FETCH_USERS_FAILURE = 'FETCH_USERS_FAILURE';

interface FetchUsersRequestAction {
  type: typeof FETCH_USERS_REQUEST;
}

interface FetchUsersSuccessAction {
  type: typeof FETCH_USERS_SUCCESS;
  payload: IUser[];
}

interface FetchUsersFailureAction {
  type: typeof FETCH_USERS_FAILURE;
  payload: string;
}

export type UsersActionTypes = FetchUsersRequestAction | FetchUsersSuccessAction | FetchUsersFailureAction;
