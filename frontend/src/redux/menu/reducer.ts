import initialState from '../store/initialState';
import { IMenuState } from './types';
import {
  TOGGLE_OVERVIEW,
  IToggleOverviewAction,
  TOGGLE_MENU,
  IToggleMenuAction,
  SET_ANCHOR_EL,
  ISetAnchorElAction,
  SET_MENU_SELECTED_PAGE,
  ISetMenuSelectedPageAction,
} from './actions';

type HandledActions = IToggleOverviewAction | IToggleMenuAction | ISetAnchorElAction | ISetMenuSelectedPageAction;

export const mnuReducer = (state: IMenuState = initialState.menu, action: HandledActions): IMenuState => {
  switch (action.type) {
    case TOGGLE_OVERVIEW:
      return { ...state, showOverview: action.payload };

    case TOGGLE_MENU:
      return { ...state, menuOpen: action.payload };

    case SET_ANCHOR_EL:
      return { ...state, anchorEl: action.payload };

    case SET_MENU_SELECTED_PAGE:
      return { ...state, menuSelectedPage: action.payload };

    default:
      return state;
  }
};
