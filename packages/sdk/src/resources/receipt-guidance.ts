import { BaseResource } from './base';

export interface AllowedTaxRule {
  id: number;
  name: string;
  description: string;
  /** Tax rates combinable with this tax rule, for example `ZERO` or `NINETEEN`. */
  taxRates: string[];
}

export interface ReceiptGuide {
  accountDatevId: number;
  accountNumber: string;
  accountName: string;
  description: string;
  allowedTaxRules: AllowedTaxRule[];
  /** Viable receipt types for this account, for example `EXPENSE`. */
  allowedReceiptTypes: string[];
}

export class ReceiptGuidanceResource extends BaseResource {
  /** Retrieves guidance for all accounts via `GET /ReceiptGuidance/forAllAccounts`. */
  public forAllAccounts(): Promise<ReceiptGuide[]> {
    return this.http.request<ReceiptGuide[]>({
      method: 'GET',
      path: '/ReceiptGuidance/forAllAccounts',
    });
  }

  /** Retrieves guidance for a datev account number via `GET /ReceiptGuidance/forAccountNumber`. */
  public forAccountNumber(options: {
    accountNumber: string;
  }): Promise<ReceiptGuide[]> {
    return this.http.request<ReceiptGuide[]>({
      method: 'GET',
      path: '/ReceiptGuidance/forAccountNumber',
      query: { accountNumber: options.accountNumber },
    });
  }

  /** Retrieves guidance for a tax rule via `GET /ReceiptGuidance/forTaxRule`. */
  public forTaxRule(options: { taxRule: string }): Promise<ReceiptGuide[]> {
    return this.http.request<ReceiptGuide[]>({
      method: 'GET',
      path: '/ReceiptGuidance/forTaxRule',
      query: { taxRule: options.taxRule },
    });
  }

  /** Retrieves guidance for revenue accounts via `GET /ReceiptGuidance/forRevenue`. */
  public forRevenue(): Promise<ReceiptGuide[]> {
    return this.http.request<ReceiptGuide[]>({
      method: 'GET',
      path: '/ReceiptGuidance/forRevenue',
    });
  }

  /** Retrieves guidance for expense accounts via `GET /ReceiptGuidance/forExpense`. */
  public forExpense(): Promise<ReceiptGuide[]> {
    return this.http.request<ReceiptGuide[]>({
      method: 'GET',
      path: '/ReceiptGuidance/forExpense',
    });
  }
}
