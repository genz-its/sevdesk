import { describe, expect, it } from 'vitest';
import { ReceiptGuidanceResource } from '../src/resources/receipt-guidance';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const guide = {
  accountDatevId: 27,
  accountNumber: '4000',
  accountName: 'Umsatzerlöse',
  description: 'Einnahmen aus dem Verkauf von Waren und Dienstleistungen',
  allowedTaxRules: [
    {
      id: 1,
      name: 'USTPFL_UMS_EINN',
      description: 'Umsatzsteuerpflichtige Umsätze',
      taxRates: ['ZERO', 'SEVEN', 'NINETEEN'],
    },
  ],
  allowedReceiptTypes: ['REVENUE'],
};

describe('ReceiptGuidanceResource', () => {
  it('requests guidance for all accounts', async () => {
    const fetch = createMockFetch({ objects: [guide] });
    const resource = new ReceiptGuidanceResource(createHttpClient(fetch));

    const guides = await resource.forAllAccounts();

    expect(guides).toEqual([guide]);
    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/ReceiptGuidance/forAllAccounts',
    );
  });

  it('requests guidance for an account number', async () => {
    const fetch = createMockFetch({ objects: [guide] });
    const resource = new ReceiptGuidanceResource(createHttpClient(fetch));

    await resource.forAccountNumber({ accountNumber: '4000' });

    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/ReceiptGuidance/forAccountNumber?accountNumber=4000',
    );
  });

  it('requests guidance for a tax rule', async () => {
    const fetch = createMockFetch({ objects: [guide] });
    const resource = new ReceiptGuidanceResource(createHttpClient(fetch));

    await resource.forTaxRule({ taxRule: 'USTPFL_UMS_EINN' });

    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/ReceiptGuidance/forTaxRule?taxRule=USTPFL_UMS_EINN',
    );
  });

  it('requests guidance for revenue accounts', async () => {
    const fetch = createMockFetch({ objects: [guide] });
    const resource = new ReceiptGuidanceResource(createHttpClient(fetch));

    await resource.forRevenue();

    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/ReceiptGuidance/forRevenue',
    );
  });

  it('requests guidance for expense accounts', async () => {
    const fetch = createMockFetch({ objects: [guide] });
    const resource = new ReceiptGuidanceResource(createHttpClient(fetch));

    await resource.forExpense();

    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/ReceiptGuidance/forExpense',
    );
  });
});
