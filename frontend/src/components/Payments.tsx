import React from 'react';
import { connect } from 'react-redux';
import { IAppState } from '../redux/store/types';
import { IApartment } from '../redux/apartments/types';
import { ITransaction, AaaFunctionType } from '../redux/payments/types';
import { timeShortDisplay, getApartment } from '../utils/utils';
import { setWSConnectedAction } from 'redux/websockets/actions';
import { prepareCreateTransactionCommandAction, addTransactionAction } from '../redux/payments/actions';
import { CheckCircle, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { UserType } from '../redux/auth/types';

// Type-safe field names for ITransaction
type TransactionField = keyof Pick<ITransaction, 'aaaFunction' | 'amount' | 'to_apartment_id'>;

/**
 * Component for managing and displaying apartment payment transactions
 * Handles creation, execution, and display of payment transactions between apartments
 * @class Payments
 * @extends React.Component<IApartmentPaymentsProps, { emptyTransaction: ITransaction }>
 */
class Payments extends React.Component<IApartmentPaymentsProps, { emptyTransaction: ITransaction }> {
  private newTransactionAmountRef = React.createRef<HTMLInputElement>();

  /**
   * Creates an initial transaction with default values
   * @returns {ITransaction} A new transaction with default values
   */
  private createInitialTransaction = (): ITransaction => ({
    id: uuidv4(),
    amount: 0,
    aaaFunction: AaaFunctionType.Deposit,
    apartment_id: this.props.currentApartment?.apartment_id || '',
    to_apartment_id: '',
    executed_at: '',
    onroute: true,
  });

  constructor(props: IApartmentPaymentsProps) {
    super(props);
    this.state = { emptyTransaction: this.createInitialTransaction() };
  }

  /**
   * Updates component when props change
   * @param {IApartmentPaymentsProps} prevProps - Previous component props
   */
  componentDidUpdate(prevProps: IApartmentPaymentsProps) {
    // Update emptyTransaction's apartment_id when currentApartment changes
    if (
      this.props.currentApartment &&
      prevProps.currentApartment?.apartment_id !== this.props.currentApartment.apartment_id &&
      !this.props.currentApartment.is_disabled
    ) {
      this.setState((prevState) => ({
        emptyTransaction: {
          ...prevState.emptyTransaction,
          apartment_id: this.props.currentApartment?.apartment_id || '',
        },
      }));
    }

    // Focus when payments are loaded
    if (prevProps.payments.length === 0 && this.props.payments.length > 0) {
      setTimeout(() => {
        const inputElement = this.newTransactionAmountRef.current;
        if (inputElement) {
          inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          inputElement.click();
        }
      }, 100);
    }
  }

  /**
   * Validates a transaction before execution
   * @param {ITransaction} transaction - Transaction to validate
   * @returns {boolean} Whether the transaction is valid
   */
  isTransactionValid = (transaction: ITransaction) => {
    if (transaction.amount <= 0) return false;
    // if (
    //   [AaaFunctionType.Withdraw, AaaFunctionType.Transfer].includes(transaction.aaaFunction) &&
    //   transaction.amount > (this.props.currentApartment?.balance || 0)
    // )
    //   return false;
    if (transaction.aaaFunction === AaaFunctionType.Transfer && !transaction.to_apartment_id) return false;
    return true;
  };

  /**
   * Updates a specific field in the empty transaction state
   * @param {TransactionField} field - Field to update
   * @param {string | number} value - New value for the field
   */
  handleEmptyTransactionChange = (field: TransactionField, value: string | number) => {
    this.setState((prevState) => ({
      emptyTransaction: {
        ...prevState.emptyTransaction,
        [field]: value,
      },
    }));
  };

  /**
   * Executes a transaction and resets the form
   * @param {ITransaction} transaction - Transaction to execute
   */
  handleExecuteTransaction = (transaction: ITransaction) => {
    this.props.addTransactionAction({ ...transaction, executed_at: new Date().toISOString() });
    this.props.prepareCreateTransactionCommandAction(transaction);
    this.setState({ emptyTransaction: this.createInitialTransaction() });
  };

  /**
   * Cancels the current transaction and resets the form
   */
  handleCancelTransaction = () => {
    this.setState({ emptyTransaction: this.createInitialTransaction() });
  };

  /**
   * Renders a single transaction row
   * @param {ITransaction} transaction - Transaction to render
   * @param {boolean} isNewTransaction - Whether this is a new transaction being created
   * @returns {JSX.Element} The rendered transaction row
   */
  renderTransaction = (transaction: ITransaction, isNewTransaction: boolean = false) => {
    const isExecuted = !!transaction.executed_at;
    const functionOptions = Object.values(AaaFunctionType);
    const isValid = !isExecuted ? this.isTransactionValid(transaction) : true;

    return (
      <>
        <div className='executedAt'>{isExecuted ? timeShortDisplay(new Date(transaction.executed_at)) : ''}</div>
        {/* <div className='amount'>
          {isExecuted ? (
            `${transaction.aaaFunction === AaaFunctionType.Deposit || transaction.to_apartment_id === this.props.currentApartment?.apartment_id ? '+' : '-'}${(
              transaction.amount ?? 0
            ).toLocaleString()}$`
          ) : (
            <input
              ref={isNewTransaction ? this.newTransactionAmountRef : undefined}
              type='number'
              // Display empty string instead of 0 to allow deleting initial value
              value={transaction.amount === 0 ? '' : transaction.amount}
              onChange={(e) => {
                if (!isExecuted) {
                  // Handle empty input as 0, otherwise parse the number
                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  // Set max amount based on transaction type - limit withdrawals/transfers to apartment balance
                  const maxAmount =
                    transaction.aaaFunction === AaaFunctionType.Withdraw || transaction.aaaFunction === AaaFunctionType.Transfer
                      ? this.props.currentApartment?.balance || 0
                      : Number.MAX_SAFE_INTEGER;

                  // Ignore invalid numbers, negative values, and amounts exceeding balance
                  if (isNaN(newValue) || newValue < 0 || newValue > maxAmount) {
                    return;
                  }
                  this.handleEmptyTransactionChange('amount' as TransactionField, newValue);
                }
              }}
              // Browser-level validation for min/max amount
              min='0'
              max={
                transaction.aaaFunction === AaaFunctionType.Withdraw || transaction.aaaFunction === AaaFunctionType.Transfer
                  ? this.props.currentApartment?.balance
                  : undefined
              }
              step='100'
              readOnly={isExecuted}
            />
          )}
        </div> */}
        <div className='aaaFunction'>
          {isExecuted ? (
            transaction.aaaFunction
          ) : (
            <select
              value={transaction.aaaFunction}
              onChange={(e) => (!isExecuted ? this.handleEmptyTransactionChange('aaaFunction' as TransactionField, e.target.value) : undefined)}
              disabled={isExecuted}
            >
              {functionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className='targetApartment'>
          {isExecuted
            ? `${
                this.props.currentApartment?.apartment_id === transaction.to_apartment_id
                  ? `<==| ${transaction.apartment_id}`
                  : transaction.to_apartment_id
                  ? `|==> ${transaction.to_apartment_id}`
                  : ''
              }`
            : transaction.aaaFunction === AaaFunctionType.Transfer && (
                <></>
                // <AccountSelector
              )}
        </div>
        {!isExecuted && (
          <div className='actions'>
            <>
              <button onClick={() => this.handleExecuteTransaction(transaction)} className='action-button' title='Execute' disabled={!isValid}>
                <CheckCircle />
              </button>
              <button onClick={() => this.handleCancelTransaction()} className='action-button' title='Cancel'>
                <XCircle />
              </button>
            </>
          </div>
        )}
      </>
    );
  };

  /**
   * Gets apartment details from either payments apartments or all apartments
   * @param {string} apartment_id - ID of apartment to get details for
   * @returns {IApartment | undefined} The apartment details if found
   */
  getApartmentDetails = (apartment_id: string) => {
    const { apartments } = this.props;
    return getApartment(apartments, apartment_id);
  };

  render() {
    const { payments } = this.props;

    return (
      <div className='page body-container'>
        <div className='header payments-container-header'>Payments</div>
        <div className='payments-container'>
          <div className={`table-header payments${this.props.isLandlord ? ' no-actions' : ''}`}>
            <div className='executedAt'>Executed At</div>
            <div className='amount'>Amount</div>
            <div className='function'>Function</div>
            <div className='targetApartment'>Target Apartment</div>
            {!this.props.isLandlord && <div className='actions'>Actions</div>}
          </div>

          <div className='payments-list'>
            {this.props.currentApartment && !this.props.currentApartment.is_disabled && !this.props.isLandlord && (
              <div className='table-row transaction input'>{this.renderTransaction(this.state.emptyTransaction, true)}</div>
            )}
            {payments.length > 0 ? (
              payments.map((transaction, index) => (
                <div
                  key={transaction.id}
                  tabIndex={index}
                  className={`table-row transaction${transaction.onroute ? ' onroute' : !!transaction.executed_at ? ' executed' : ''}${
                    this.props.isLandlord ? ' no-actions' : ''
                  }`}
                >
                  {this.renderTransaction(transaction)}
                </div>
              ))
            ) : (
              <span className='no-payments'>..</span>
            )}
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Props interface for Payments component
 * @interface IApartmentPaymentsProps
 */
interface IApartmentPaymentsProps {
  /** Whether the current user is a landlord */
  isLandlord: boolean | null;
  /** List of payment transactions */
  payments: ITransaction[];
  /** List of all apartments */
  apartments: IApartment[];
  /** Currently selected apartment */
  currentApartment: IApartment | undefined;
  /** Action to set WebSocket connection status */
  setWSConnectedAction: typeof setWSConnectedAction;
  /** Action to prepare a new transaction */
  prepareCreateTransactionCommandAction: typeof prepareCreateTransactionCommandAction;
  /** Action to add a new transaction */
  addTransactionAction: typeof addTransactionAction;
}

/**
 * Maps Redux state to component props
 * @param {IAppState} state - Current Redux state
 * @returns {Partial<IApartmentPaymentsProps>} Props derived from state
 */
const mapStateToProps = (state: IAppState) => ({
  isLandlord: state.auth.userType === UserType.Landlord,
  payments: state.payments.payments,
  apartments: state.apartments.apartments,
  currentApartment: state.apartments.currentApartmentId
    ? state.apartments.apartments.find((acc) => acc.apartment_id === state.apartments.currentApartmentId)
    : undefined,
});

// Map Redux actions to component props
const mapDispatchToProps = {
  setWSConnectedAction,
  prepareCreateTransactionCommandAction,
  addTransactionAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(Payments);
