import { combineReducers } from 'redux';
import { mnuReducer } from '../menu/reducer';
import { authReducer } from '../auth/reducer';
import { websocketsReducer } from '../websockets/reducer';
import { crudReducer } from '../crud/reducer';
import { apartmentsReducer } from '../apartments/reducer';
import { paymentsReducer } from '../payments/reducer';
import { usersReducer } from '../users/reducer';
import documentsReducer from '../documents/slice';

const rootReducer = combineReducers({
  menu: mnuReducer,
  auth: authReducer,
  websockets: websocketsReducer,
  crud: crudReducer,
  apartments: apartmentsReducer,
  payments: paymentsReducer,
  users: usersReducer,
  documents: documentsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
