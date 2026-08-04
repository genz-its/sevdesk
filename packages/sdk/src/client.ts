import type { SevDeskOptions } from './http-client';
import { HttpClient } from './http-client';
import { BasicsResource } from './resources/basics';
import { CheckAccountsResource } from './resources/check-accounts';
import { CommunicationWaysResource } from './resources/communication-ways';
import { ContactAddressesResource } from './resources/contact-addresses';
import { ContactsResource } from './resources/contacts';
import { CreditNotesResource } from './resources/credit-notes';
import { ExportsResource } from './resources/exports';
import { InvoicesResource } from './resources/invoices';
import { OrdersResource } from './resources/orders';
import { PartsResource } from './resources/parts';
import { ReceiptGuidanceResource } from './resources/receipt-guidance';
import { ReportsResource } from './resources/reports';
import { TagsResource } from './resources/tags';
import { TransactionsResource } from './resources/transactions';
import { VouchersResource } from './resources/vouchers';

export class SevDesk {
  public readonly basics: BasicsResource;
  public readonly checkAccounts: CheckAccountsResource;
  public readonly communicationWays: CommunicationWaysResource;
  public readonly contactAddresses: ContactAddressesResource;
  public readonly contacts: ContactsResource;
  public readonly creditNotes: CreditNotesResource;
  public readonly exports: ExportsResource;
  public readonly invoices: InvoicesResource;
  public readonly orders: OrdersResource;
  public readonly parts: PartsResource;
  public readonly receiptGuidance: ReceiptGuidanceResource;
  public readonly reports: ReportsResource;
  public readonly tags: TagsResource;
  public readonly transactions: TransactionsResource;
  public readonly vouchers: VouchersResource;

  constructor(options: SevDeskOptions) {
    const http = new HttpClient(options);
    this.basics = new BasicsResource(http);
    this.checkAccounts = new CheckAccountsResource(http);
    this.communicationWays = new CommunicationWaysResource(http);
    this.contactAddresses = new ContactAddressesResource(http);
    this.contacts = new ContactsResource(http);
    this.creditNotes = new CreditNotesResource(http);
    this.exports = new ExportsResource(http);
    this.invoices = new InvoicesResource(http);
    this.orders = new OrdersResource(http);
    this.parts = new PartsResource(http);
    this.receiptGuidance = new ReceiptGuidanceResource(http);
    this.reports = new ReportsResource(http);
    this.tags = new TagsResource(http);
    this.transactions = new TransactionsResource(http);
    this.vouchers = new VouchersResource(http);
  }
}
