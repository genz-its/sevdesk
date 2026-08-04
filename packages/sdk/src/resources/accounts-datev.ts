import { SevDeskError } from '../errors';
import type { ListOptions, ModelRefResponse } from '../types';
import { BaseResource } from './base';

/**
 * A booking account (DATEV account). Returned by an endpoint that is not part
 * of the documented sevdesk API — fields reflect observed responses.
 */
export interface AccountDatev {
  id: string;
  objectName: string;
  /** The account number in the client's accounting system (e.g. SKR04). */
  number: string | null;
  /** The corresponding SKR03 account number. */
  number03: string | null;
  name: string | null;
  name03: string | null;
  taxRate: string | null;
  deprecated: string | null;
  hidden: string | null;
  deactivated: string | null;
  expenseAccount: string | null;
  revenueAccount: string | null;
  assetAccount: string | null;
  balanceSide: string | null;
  simpleDescription: string | null;
  translatedNumber: string | null;
  translatedName: string | null;
  validFrom: string | null;
  validUntil: string | null;
  accountCategory: ModelRefResponse | null;
  accountDatevCategory: ModelRefResponse | null;
}

/**
 * Booking accounts (`AccountDatev`). Backed by the undocumented
 * `/AccountDatev` endpoint, which sevdesk may change without notice — the
 * documented alternative is `ReceiptGuidanceResource`, which only covers the
 * VAT-relevant subset of accounts.
 */
export class AccountsDatevResource extends BaseResource {
  /**
   * Retrieves booking accounts via the undocumented `GET /AccountDatev`.
   * Returns only accounts that are visible in the sevdesk account picker
   * (`hidden` = `0`); the endpoint ignores all filters except `limit` and
   * `offset`. Hidden accounts are reachable via `get`.
   */
  public list(options: ListOptions = {}): Promise<AccountDatev[]> {
    return this.http.request<AccountDatev[]>({
      method: 'GET',
      path: '/AccountDatev',
      query: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  }

  /**
   * Retrieves a single booking account via the undocumented
   * `GET /AccountDatev/{accountDatevId}`. Also works for hidden accounts.
   */
  public async get(options: { accountDatevId: number }): Promise<AccountDatev> {
    const accounts = await this.http.request<AccountDatev[]>({
      method: 'GET',
      path: `/AccountDatev/${options.accountDatevId}`,
    });
    const account = accounts[0];
    if (!account) {
      throw new SevDeskError({
        status: 404,
        statusText: 'Not Found',
        body: null,
      });
    }
    return account;
  }
}
