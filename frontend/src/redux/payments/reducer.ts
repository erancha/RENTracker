// Reducers
import { PaymentsState } from './types';
import initialState from '../store/initialState';
import {
  SET_TRANSACTIONS,
  ISetPaymentsAction,
  ADD_TRANSACTION,
  IAddTransactionAction,
  SET_TRANSACTION_CONFIRMED_BY_BACKEND,
  ISetTransactionConfirmedByBackendAction,
  CLEAR_TRANSACTIONS,
  IClearPaymentsAction,
} from './actions';

type HandledActions = ISetPaymentsAction | IAddTransactionAction | ISetTransactionConfirmedByBackendAction | IClearPaymentsAction;

export const paymentsReducer = (state: PaymentsState = initialState.payments, action: HandledActions): PaymentsState => {
  switch (action.type) {
    // Set payments data.
    case SET_TRANSACTIONS:
      return {
        ...state,
        payments: action.payload,
      };

    // Add a transaction.
    case ADD_TRANSACTION: {
      return {
        ...state,
        payments: [action.payload, ...state.payments],
      };
    }

    // Set transaction as onroute
    case SET_TRANSACTION_CONFIRMED_BY_BACKEND: {
      return {
        ...state,
        payments: state.payments.map((transaction) => (transaction.id === action.payload ? { ...transaction, onroute: false } : transaction)),
      };
    }

    // Clear all payments
    case CLEAR_TRANSACTIONS: {
      return {
        ...state,
        payments: [],
      };
    }

    default:
      return state;
  }
};
