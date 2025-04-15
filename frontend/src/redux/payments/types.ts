import { IOnRoute } from '../store/types';

/**
 * Represents a new transaction to be sent to the backend.
 * Used as the data payload when uploading a transaction.
 */
export interface INewTransaction {
  id: string; // Unique identifier for the transaction
  amount: number; // Amount of money involved
  aaaFunction: AaaFunctionType; // Type of transaction: deposit/withdraw/transfer
  apartment_id: string; // Source apartment ID
  to_apartment_id: string | null; // Target apartment ID (same as apartment_id for deposit/withdraw)
}

/**
 * Represents a transaction as stored in the Redux state.
 * Extends INewTransaction to include execution timestamp and on route status.
 */
export interface ITransaction extends INewTransaction, IOnRoute {
  executed_at: string; // Timestamp when the transaction was executed
}

// Transaction CRUD params
export interface ICreateTransactionParams {
  id: string;
  amount: number;
  aaaFunction: AaaFunctionType;
  apartment_id: string;
  to_apartment_id?: string | null;
}

export interface IReadTransactionParams {
  apartment_id?: string;
}

// Transaction-specific action types
export const SET_TRANSACTIONS = 'SET_TRANSACTIONS';
export const ADD_TRANSACTION = 'ADD_TRANSACTION';

// Transaction-specific action interfaces
export interface ISetPaymentsAction {
  type: typeof SET_TRANSACTIONS;
  payload: ITransaction[];
}

export interface IAddTransactionAction {
  type: typeof ADD_TRANSACTION;
  payload: ITransaction;
}

export type TransactionActionTypes = ISetPaymentsAction | IAddTransactionAction;

export interface PaymentsState {
  payments: ITransaction[];
  analyticsData: any[];
}

export enum AaaFunctionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Transfer = 'transfer',
}

export interface INewTransaction {
  id: string;
  amount: number;
  aaaFunction: AaaFunctionType;
  apartment_id: string;
  to_apartment_id: string | null;
}
