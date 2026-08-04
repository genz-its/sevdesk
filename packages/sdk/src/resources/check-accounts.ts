import { toPlainDate } from '../dates';
import { SevDeskError } from '../errors';
import type { DateInput, ListOptions, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/** A payment account, e.g. a bank account or a clearing account. */
export interface CheckAccount {
  id: string;
  objectName: string;
  create: string;
  update: string;
  sevClient: ModelRefResponse;
  name: string;
  iban: string | null;
  type: 'online' | 'offline' | 'register';
  importType: 'CSV' | 'MT940' | null;
  currency: string;
  defaultAccount: string;
  baseAccount: string;
  priority: string;
  status: string;
  balance: string | null;
  bankServer: string | null;
  autoMapTransactions: string | null;
  autoSyncTransactions: string;
  lastSync: string;
  accountingNumber: string;
  bic: string | null;
}

export interface CreateFileImportAccountOptions {
  name: string;
  importType: 'CSV' | 'MT940';
  accountingNumber?: number;
  iban?: string;
}

export interface CreateClearingAccountOptions {
  name: string;
  accountingNumber?: number;
}

export interface UpdateCheckAccountOptions {
  checkAccountId: number;
  name?: string;
  defaultAccount?: number;
  autoMapTransactions?: number;
  accountingNumber?: number;
  iban?: string;
  bic?: string;
}

export class CheckAccountsResource extends BaseResource {
  /** Retrieves all check accounts via `GET /CheckAccount`. */
  public async list(options: ListOptions = {}): Promise<CheckAccount[]> {
    return this.http.request<CheckAccount[]>({
      method: 'GET',
      path: '/CheckAccount',
      query: { limit: options.limit, offset: options.offset },
    });
  }

  /** Retrieves a single check account via `GET /CheckAccount/{checkAccountId}`. */
  public async get(options: { checkAccountId: number }): Promise<CheckAccount> {
    const checkAccounts = await this.http.request<CheckAccount[]>({
      method: 'GET',
      path: `/CheckAccount/${options.checkAccountId}`,
    });
    const checkAccount = checkAccounts[0];
    if (!checkAccount) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return checkAccount;
  }

  /** Creates a file import account via `POST /CheckAccount/Factory/fileImportAccount`. */
  public async createFileImportAccount(
    options: CreateFileImportAccountOptions,
  ): Promise<CheckAccount> {
    return this.http.request<CheckAccount>({
      method: 'POST',
      path: '/CheckAccount/Factory/fileImportAccount',
      body: options,
    });
  }

  /** Creates a clearing account via `POST /CheckAccount/Factory/clearingAccount`. */
  public async createClearingAccount(
    options: CreateClearingAccountOptions,
  ): Promise<CheckAccount> {
    return this.http.request<CheckAccount>({
      method: 'POST',
      path: '/CheckAccount/Factory/clearingAccount',
      body: options,
    });
  }

  /** Updates a check account via `PUT /CheckAccount/{checkAccountId}`. */
  public async update(
    options: UpdateCheckAccountOptions,
  ): Promise<CheckAccount> {
    const { checkAccountId, ...body } = options;
    return this.http.request<CheckAccount>({
      method: 'PUT',
      path: `/CheckAccount/${checkAccountId}`,
      body,
    });
  }

  /** Deletes a check account via `DELETE /CheckAccount/{checkAccountId}`. */
  public async delete(options: { checkAccountId: number }): Promise<void> {
    await this.http.request<void>({
      method: 'DELETE',
      path: `/CheckAccount/${options.checkAccountId}`,
    });
  }

  /**
   * Retrieves the balance at a date via `GET /CheckAccount/{checkAccountId}/getBalanceAtDate`.
   *
   * The balance is the sum of all transactions sevdesk knows up to and
   * including the given date. It does not have to match the actual bank
   * account balance, e.g. if old transactions were never imported.
   */
  public async getBalanceAtDate(options: {
    checkAccountId: number;
    date: DateInput;
  }): Promise<string> {
    return this.http.request<string>({
      method: 'GET',
      path: `/CheckAccount/${options.checkAccountId}/getBalanceAtDate`,
      query: { date: toPlainDate(options.date) },
    });
  }
}
