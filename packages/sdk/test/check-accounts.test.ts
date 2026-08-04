import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { CheckAccountsResource } from '../src/resources/check-accounts';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const checkAccount = {
  id: '2',
  objectName: 'CheckAccount',
  name: 'Iron Bank',
  type: 'online',
  importType: 'CSV',
};

describe('CheckAccountsResource', () => {
  describe('list', () => {
    it('requests all check accounts', async () => {
      const fetch = createMockFetch({ objects: [checkAccount] });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      const result = await resource.list();

      const { url, init } = lastRequest(fetch);
      expect(url).toBe('https://my.sevdesk.de/api/v1/CheckAccount');
      expect(init.method).toBe('GET');
      expect(result).toEqual([checkAccount]);
    });

    it('passes limit and offset', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await resource.list({ limit: 10, offset: 20 });

      expect(lastRequest(fetch).url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccount?limit=10&offset=20',
      );
    });
  });

  describe('get', () => {
    it('unwraps the single element array', async () => {
      const fetch = createMockFetch({ objects: [checkAccount] });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      const result = await resource.get({ checkAccountId: 2 });

      expect(lastRequest(fetch).url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccount/2',
      );
      expect(result).toEqual(checkAccount);
    });

    it('throws a 404 error when no check account was returned', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await expect(resource.get({ checkAccountId: 2 })).rejects.toMatchObject({
        name: 'SevDeskError',
        status: 404,
        statusText: 'Not Found',
      });
      await expect(resource.get({ checkAccountId: 2 })).rejects.toBeInstanceOf(
        SevDeskError,
      );
    });
  });

  describe('createFileImportAccount', () => {
    it('sends the account data as a flat body', async () => {
      const fetch = createMockFetch({ objects: checkAccount });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      const result = await resource.createFileImportAccount({
        name: 'Iron Bank',
        importType: 'CSV',
        accountingNumber: 1800,
        iban: 'DE02100500000054540402',
      });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccount/Factory/fileImportAccount',
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'Iron Bank',
        importType: 'CSV',
        accountingNumber: 1800,
        iban: 'DE02100500000054540402',
      });
      expect(result).toEqual(checkAccount);
    });

    it('omits optional properties', async () => {
      const fetch = createMockFetch({ objects: checkAccount });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await resource.createFileImportAccount({
        name: 'Iron Bank',
        importType: 'MT940',
      });

      expect(JSON.parse(lastRequest(fetch).init.body as string)).toEqual({
        name: 'Iron Bank',
        importType: 'MT940',
      });
    });
  });

  describe('createClearingAccount', () => {
    it('sends the account data as a flat body', async () => {
      const fetch = createMockFetch({ objects: checkAccount });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await resource.createClearingAccount({
        name: 'Coupons',
        accountingNumber: 3320,
      });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccount/Factory/clearingAccount',
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'Coupons',
        accountingNumber: 3320,
      });
    });
  });

  describe('update', () => {
    it('excludes the check account id from the body', async () => {
      const fetch = createMockFetch({ objects: checkAccount });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await resource.update({
        checkAccountId: 2,
        name: 'Iron Bank',
        defaultAccount: 1,
        autoMapTransactions: 0,
        accountingNumber: 1800,
        iban: 'DE02100500000054540402',
        bic: 'BELADEBEXXX',
      });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe('https://my.sevdesk.de/api/v1/CheckAccount/2');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'Iron Bank',
        defaultAccount: 1,
        autoMapTransactions: 0,
        accountingNumber: 1800,
        iban: 'DE02100500000054540402',
        bic: 'BELADEBEXXX',
      });
    });
  });

  describe('delete', () => {
    it('deletes the check account', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      await resource.delete({ checkAccountId: 2 });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe('https://my.sevdesk.de/api/v1/CheckAccount/2');
      expect(init.method).toBe('DELETE');
    });
  });

  describe('getBalanceAtDate', () => {
    it('sends a plain date and returns the raw balance', async () => {
      const fetch = createMockFetch({ objects: '105.56' });
      const resource = new CheckAccountsResource(createHttpClient(fetch));

      const result = await resource.getBalanceAtDate({
        checkAccountId: 2,
        date: new Date('2024-05-10T14:42:58.000Z'),
      });

      expect(lastRequest(fetch).url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccount/2/getBalanceAtDate?date=2024-05-10',
      );
      expect(result).toBe('105.56');
    });
  });
});
