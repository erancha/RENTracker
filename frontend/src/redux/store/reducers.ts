import { combineReducers } from 'redux';
import { mnuReducer } from '../menu/reducer';
import { authReducer } from '../auth/reducer';
import { websocketsReducer } from '../websockets/reducer';
import { crudReducer } from '../crud/reducer';
import { apartmentsReducer } from '../apartments/reducer';
import { apartmentActivityReducer } from '../apartmentActivity/reducer';
import documentsReducer from '../documents/slice';
import { saasTenantsReducer } from '../saasTenants/reducer';

const rootReducer = combineReducers({
  menu: mnuReducer,
  auth: authReducer,
  websockets: websocketsReducer,
  crud: crudReducer,
  apartments: apartmentsReducer,
  apartmentActivity: apartmentActivityReducer,
  documents: documentsReducer,
  saasTenants: saasTenantsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
