import initialState from '../store/initialState';
import { IAuthState, UserType } from './types';
import { SET_AUTH_LOGIN_SUCCESS, ISetAuthLoginSuccessAction, SET_USER_TYPE, ISetUserTypeAction, SET_AUTH_LOGOUT, ISetAuthLogoutAction } from './actions';

type HandledActions = ISetAuthLoginSuccessAction | ISetUserTypeAction | ISetAuthLogoutAction;

export const authReducer = (state: IAuthState = initialState.auth, action: HandledActions): IAuthState => {
  switch (action.type) {
    case SET_AUTH_LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        ...action.payload,
      };

    case SET_USER_TYPE:
      return { ...state, userType: action.payload };

    case SET_AUTH_LOGOUT:
      return {
        ...state,
        isAuthenticated: false,
        JWT: null,
        userId: null,
        userName: null,
        userType: UserType.Tenant,
      };

    default:
      return state;
  }
};
