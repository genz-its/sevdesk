import type { SevDeskOptions } from './http-client';
import { HttpClient } from './http-client';
import { BasicsResource } from './resources/basics';
import { CheckAccountsResource } from './resources/check-accounts';
import { ReceiptGuidanceResource } from './resources/receipt-guidance';
import { TransactionsResource } from './resources/transactions';
import { VouchersResource } from './resources/vouchers';

export class SevDesk {
  public readonly basics: BasicsResource;
  public readonly checkAccounts: CheckAccountsResource;
  public readonly receiptGuidance: ReceiptGuidanceResource;
  public readonly transactions: TransactionsResource;
  public readonly vouchers: VouchersResource;

  constructor(options: SevDeskOptions) {
    const http = new HttpClient(options);
    this.basics = new BasicsResource(http);
    this.checkAccounts = new CheckAccountsResource(http);
    this.receiptGuidance = new ReceiptGuidanceResource(http);
    this.transactions = new TransactionsResource(http);
    this.vouchers = new VouchersResource(http);
  }
}
