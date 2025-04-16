//=================
// Root State
//=================

import { IMenuState } from '../menu/types';
import { IAuthState } from '../auth/types';
import { IWebsocketsState } from '../websockets/types';
import { ICrudState } from '../crud/types';
import { IApartmentsState } from '../apartments/types';
import { ActivityState as IActivityState } from '../activity/types';
import { IUsersState } from '../users/types';
import { IDocumentsState } from '../documents/types';

/**
 * The root state type that combines all feature states.
 * Used for type-safe access to the Redux store.
 */
export interface IAppState {
  menu: IMenuState;
  auth: IAuthState;
  websockets: IWebsocketsState;
  crud: ICrudState;
  apartments: IApartmentsState;
  activity: IActivityState;
  users: IUsersState;
  documents: IDocumentsState;
}

/**
 * Interface for entities that can be marked as "on route" while being processed by the backend
 */
export interface IOnRoute {
  onroute: boolean;
}
