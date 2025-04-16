//=================
// Root State
//=================

import { IMenuState } from '../menu/types';
import { IAuthState } from '../auth/types';
import { IWebsocketsState } from '../websockets/types';
import { ICrudState } from '../crud/types';
import { IApartmentsState } from '../apartments/types';
import { IApartmentActivityState } from '../apartmentActivity/types';
import { IDocumentsState } from '../documents/types';
import { IUsersState } from '../users/types';

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
  apartmentActivity: IApartmentActivityState;
  documents: IDocumentsState;
  users: IUsersState;
}
