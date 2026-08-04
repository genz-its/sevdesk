import { toIsoDateTime } from '../dates';
import { SevDeskError } from '../errors';
import type { DateInput, ListOptions, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/**
 * Status of a transaction.
 *
 * - `100` created
 * - `200` linked
 * - `300` private
 * - `350` auto-booked without user confirmation
 * - `400` booked
 */
export type TransactionStatus = 100 | 200 | 300 | 350 | 400;

/** A transaction on a check account. */
export interface CheckAccountTransaction {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  valueDate: string;
  entryDate: string | null;
  paymtPurpose: string | null;
  amount: string;
  payeePayerName: string | null;
  payeePayerAcctNo: string | null;
  payeePayerBankCode: string | null;
  checkAccount: ModelRefResponse;
  status: string;
  enshrined: string | null;
  sourceTransaction: ModelRefResponse | null;
  targetTransaction: ModelRefResponse | null;
  gvCode: string | null;
  entryText: string | null;
  primaNotaNo: string | null;
}

export interface ListTransactionsOptions extends ListOptions {
  checkAccountId?: number;
  /**
   * Documented by sevdesk, but the API is known to ignore `false` — filter
   * client-side on `status` to find unbooked transactions.
   */
  isBooked?: boolean;
  paymtPurpose?: string;
  startDate?: DateInput;
  endDate?: DateInput;
  payeePayerName?: string;
  onlyCredit?: boolean;
  onlyDebit?: boolean;
}

export interface CreateTransactionOptions {
  checkAccountId: number;
  valueDate: DateInput;
  entryDate?: DateInput;
  amount: number;
  payeePayerName: string;
  paymtPurpose?: string;
  payeePayerAcctNo?: string;
  payeePayerBankCode?: string;
  /** Defaults to `100`, the only status that makes sense on creation. */
  status?: TransactionStatus;
}

export interface UpdateTransactionOptions {
  transactionId: number;
  valueDate?: DateInput;
  entryDate?: DateInput;
  paymtPurpose?: string;
  amount?: number;
  payeePayerName?: string;
  status?: TransactionStatus;
}

export class TransactionsResource extends BaseResource {
  /** Retrieves transactions via `GET /CheckAccountTransaction`. */
  public async list(
    options: ListTransactionsOptions = {},
  ): Promise<CheckAccountTransaction[]> {
    return this.http.request<CheckAccountTransaction[]>({
      method: 'GET',
      path: '/CheckAccountTransaction',
      query: {
        'checkAccount[id]': options.checkAccountId,
        'checkAccount[objectName]':
          options.checkAccountId === undefined ? undefined : 'CheckAccount',
        isBooked: options.isBooked,
        paymtPurpose: options.paymtPurpose,
        startDate: toOptionalIsoDateTime(options.startDate),
        endDate: toOptionalIsoDateTime(options.endDate),
        payeePayerName: options.payeePayerName,
        onlyCredit: options.onlyCredit,
        onlyDebit: options.onlyDebit,
        limit: options.limit,
        offset: options.offset,
      },
    });
  }

  /** Retrieves a single transaction via `GET /CheckAccountTransaction/{transactionId}`. */
  public async get(options: {
    transactionId: number;
  }): Promise<CheckAccountTransaction> {
    const transactions = await this.http.request<CheckAccountTransaction[]>({
      method: 'GET',
      path: `/CheckAccountTransaction/${options.transactionId}`,
    });
    const transaction = transactions[0];
    if (!transaction) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return transaction;
  }

  /**
   * Creates a transaction via `POST /CheckAccountTransaction`.
   *
   * Should only be used on check accounts of type online, preferably on
   * accounts that import their transactions from CSV files.
   */
  public async create(
    options: CreateTransactionOptions,
  ): Promise<CheckAccountTransaction> {
    return this.http.request<CheckAccountTransaction>({
      method: 'POST',
      path: '/CheckAccountTransaction',
      body: {
        objectName: 'CheckAccountTransaction',
        mapAll: true,
        valueDate: toIsoDateTime(options.valueDate),
        entryDate: toOptionalIsoDateTime(options.entryDate),
        amount: options.amount,
        payeePayerName: options.payeePayerName,
        paymtPurpose: options.paymtPurpose,
        payeePayerAcctNo: options.payeePayerAcctNo,
        payeePayerBankCode: options.payeePayerBankCode,
        checkAccount: {
          id: options.checkAccountId,
          objectName: 'CheckAccount',
        },
        status: options.status ?? 100,
      },
    });
  }

  /** Updates a transaction via `PUT /CheckAccountTransaction/{transactionId}`. */
  public async update(
    options: UpdateTransactionOptions,
  ): Promise<CheckAccountTransaction> {
    const { transactionId, valueDate, entryDate, ...rest } = options;
    return this.http.request<CheckAccountTransaction>({
      method: 'PUT',
      path: `/CheckAccountTransaction/${transactionId}`,
      body: {
        ...rest,
        valueDate: toOptionalIsoDateTime(valueDate),
        entryDate: toOptionalIsoDateTime(entryDate),
      },
    });
  }

  /** Deletes a transaction via `DELETE /CheckAccountTransaction/{transactionId}`. */
  public async delete(options: { transactionId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/CheckAccountTransaction/${options.transactionId}`,
    });
  }

  /**
   * Enshrines a transaction via `PUT /CheckAccountTransaction/{transactionId}/enshrine`.
   *
   * Requires a status of at least `200` and cannot be undone. Linked invoices,
   * credit notes and vouchers can no longer be changed afterwards.
   */
  public async enshrine(options: { transactionId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'PUT',
      path: `/CheckAccountTransaction/${options.transactionId}/enshrine`,
    });
  }
}

function toOptionalIsoDateTime(
  value: DateInput | undefined,
): string | undefined {
  return value === undefined ? undefined : toIsoDateTime(value);
}
