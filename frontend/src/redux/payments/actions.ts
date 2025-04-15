import { ITransaction, ICreateTransactionParams } from './types';
import { CommandType } from '../crud/types';
import { prepareCreateCommandAction, prepareReadCommandAction, prepareUpdateCommandAction } from '../crud/actions';

// Transaction-specific action types
export const SET_TRANSACTIONS = 'SET_TRANSACTIONS';
export const ADD_TRANSACTION = 'ADD_TRANSACTION';
export const SET_TRANSACTION_CONFIRMED_BY_BACKEND = 'SET_TRANSACTION_CONFIRMED_BY_BACKEND';
export const CLEAR_TRANSACTIONS = 'CLEAR_TRANSACTIONS';

// Transaction-specific action interfaces
export interface ISetPaymentsAction {
  type: typeof SET_TRANSACTIONS;
  payload: ITransaction[];
}

export interface IAddTransactionAction {
  type: typeof ADD_TRANSACTION;
  payload: ITransaction;
}

export interface ISetTransactionConfirmedByBackendAction {
  type: typeof SET_TRANSACTION_CONFIRMED_BY_BACKEND;
  payload: string; // transaction id
}

export interface IClearPaymentsAction {
  type: typeof CLEAR_TRANSACTIONS;
}

// CRUD operations
export const prepareCreateTransactionCommandAction = (transaction: ITransaction) =>
  prepareCreateCommandAction({
    type: 'payments' as CommandType,
    params: {
      id: transaction.id,
      amount: transaction.amount,
      aaaFunction: transaction.aaaFunction,
      apartment_id: transaction.apartment_id,
      to_apartment_id: transaction.to_apartment_id,
    } as ICreateTransactionParams,
  });

export const prepareReadPaymentsCommandAction = (apartment_id: string) =>
  prepareReadCommandAction({
    type: 'payments' as CommandType,
    params: { apartment_id },
  });

export const prepareUpdateTransactionCommandAction = (transactionId: string, updates: Partial<ITransaction>) =>
  prepareUpdateCommandAction({
    type: 'payments' as CommandType,
    params: {
      id: transactionId,
      ...updates,
    },
  });

// Regular actions
export const setPaymentsAction = (payments: ITransaction[]): ISetPaymentsAction => ({
  type: SET_TRANSACTIONS,
  payload: payments,
});

export const addTransactionAction = (transaction: ITransaction): IAddTransactionAction => ({
  type: ADD_TRANSACTION,
  payload: transaction,
});

export const setTransactionConfirmedByBackendAction = (transactionId: string): ISetTransactionConfirmedByBackendAction => ({
  type: SET_TRANSACTION_CONFIRMED_BY_BACKEND,
  payload: transactionId,
});

export const clearPaymentsAction = (): IClearPaymentsAction => ({
  type: CLEAR_TRANSACTIONS,
});
