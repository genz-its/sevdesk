import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { TransactionsResource } from '../src/resources/transactions';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const transaction = {
  id: '1',
  objectName: 'CheckAccountTransaction',
  amount: '-100.32',
  payeePayerName: 'Cercei Lannister',
};

describe('TransactionsResource', () => {
  describe('list', () => {
    it('requests all transactions', async () => {
      const fetch = createMockFetch({ objects: [transaction] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      const result = await resource.list();

      const { url, init } = lastRequest(fetch);
      expect(url).toBe('https://my.sevdesk.de/api/v1/CheckAccountTransaction');
      expect(init.method).toBe('GET');
      expect(result).toEqual([transaction]);
    });

    it('expands the check account id into a model reference', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.list({ checkAccountId: 42 });

      expect(lastRequest(fetch).url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccountTransaction' +
          '?checkAccount%5Bid%5D=42&checkAccount%5BobjectName%5D=CheckAccount',
      );
    });

    it('serializes all filters', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.list({
        isBooked: true,
        paymtPurpose: 'salary',
        startDate: new Date('2024-05-01T00:00:00.000Z'),
        endDate: '2024-05-31T23:59:59+02:00',
        payeePayerName: 'Cercei Lannister',
        onlyCredit: false,
        onlyDebit: true,
        limit: 50,
        offset: 100,
      });

      const query = new URL(lastRequest(fetch).url).searchParams;
      expect(Object.fromEntries(query)).toEqual({
        isBooked: '1',
        paymtPurpose: 'salary',
        startDate: '2024-05-01T00:00:00.000Z',
        endDate: '2024-05-31T23:59:59+02:00',
        payeePayerName: 'Cercei Lannister',
        onlyCredit: '0',
        onlyDebit: '1',
        limit: '50',
        offset: '100',
      });
    });
  });

  describe('get', () => {
    it('unwraps the single element array', async () => {
      const fetch = createMockFetch({ objects: [transaction] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      const result = await resource.get({ transactionId: 1 });

      expect(lastRequest(fetch).url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccountTransaction/1',
      );
      expect(result).toEqual(transaction);
    });

    it('throws a 404 error when no transaction was returned', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await expect(resource.get({ transactionId: 1 })).rejects.toBeInstanceOf(
        SevDeskError,
      );
      await expect(resource.get({ transactionId: 1 })).rejects.toMatchObject({
        status: 404,
        statusText: 'Not Found',
      });
    });
  });

  describe('create', () => {
    it('adds the boilerplate and the check account reference', async () => {
      const fetch = createMockFetch({ objects: transaction });
      const resource = new TransactionsResource(createHttpClient(fetch));

      const result = await resource.create({
        checkAccountId: 42,
        valueDate: new Date('2024-05-10T00:00:00.000Z'),
        entryDate: 1715385600,
        amount: -100.32,
        payeePayerName: 'Cercei Lannister',
        paymtPurpose: 'salary',
        payeePayerAcctNo: 'DE02100500000054540402',
        payeePayerBankCode: 'BELADEBEXXX',
      });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe('https://my.sevdesk.de/api/v1/CheckAccountTransaction');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        objectName: 'CheckAccountTransaction',
        mapAll: true,
        valueDate: '2024-05-10T00:00:00.000Z',
        entryDate: '2024-05-11T00:00:00.000Z',
        amount: -100.32,
        payeePayerName: 'Cercei Lannister',
        paymtPurpose: 'salary',
        payeePayerAcctNo: 'DE02100500000054540402',
        payeePayerBankCode: 'BELADEBEXXX',
        checkAccount: { id: 42, objectName: 'CheckAccount' },
        status: 100,
      });
      expect(result).toEqual(transaction);
    });

    it('defaults the status to 100 and omits unset properties', async () => {
      const fetch = createMockFetch({ objects: transaction });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.create({
        checkAccountId: 42,
        valueDate: '2024-05-10T00:00:00+02:00',
        amount: 100.1,
        payeePayerName: 'Cercei Lannister',
      });

      expect(JSON.parse(lastRequest(fetch).init.body as string)).toEqual({
        objectName: 'CheckAccountTransaction',
        mapAll: true,
        valueDate: '2024-05-10T00:00:00+02:00',
        amount: 100.1,
        payeePayerName: 'Cercei Lannister',
        checkAccount: { id: 42, objectName: 'CheckAccount' },
        status: 100,
      });
    });

    it('keeps an explicit status', async () => {
      const fetch = createMockFetch({ objects: transaction });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.create({
        checkAccountId: 42,
        valueDate: '2024-05-10T00:00:00+02:00',
        amount: 100.1,
        payeePayerName: 'Cercei Lannister',
        status: 200,
      });

      expect(JSON.parse(lastRequest(fetch).init.body as string)).toMatchObject({
        status: 200,
      });
    });
  });

  describe('update', () => {
    it('excludes the transaction id and serializes dates', async () => {
      const fetch = createMockFetch({ objects: transaction });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.update({
        transactionId: 1,
        valueDate: new Date('2024-05-10T00:00:00.000Z'),
        entryDate: new Date('2024-05-11T00:00:00.000Z'),
        paymtPurpose: 'salary',
        amount: 100.1,
        payeePayerName: 'Cercei Lannister',
        status: 400,
      });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccountTransaction/1',
      );
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({
        valueDate: '2024-05-10T00:00:00.000Z',
        entryDate: '2024-05-11T00:00:00.000Z',
        paymtPurpose: 'salary',
        amount: 100.1,
        payeePayerName: 'Cercei Lannister',
        status: 400,
      });
    });

    it('omits dates that were not given', async () => {
      const fetch = createMockFetch({ objects: transaction });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.update({ transactionId: 1, paymtPurpose: 'rent' });

      expect(JSON.parse(lastRequest(fetch).init.body as string)).toEqual({
        paymtPurpose: 'rent',
      });
    });
  });

  describe('delete', () => {
    it('deletes the transaction', async () => {
      const fetch = createMockFetch({ objects: [] });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.delete({ transactionId: 1 });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccountTransaction/1',
      );
      expect(init.method).toBe('DELETE');
    });
  });

  describe('enshrine', () => {
    it('enshrines the transaction without a body', async () => {
      const fetch = createMockFetch({ objects: null });
      const resource = new TransactionsResource(createHttpClient(fetch));

      await resource.enshrine({ transactionId: 1 });

      const { url, init } = lastRequest(fetch);
      expect(url).toBe(
        'https://my.sevdesk.de/api/v1/CheckAccountTransaction/1/enshrine',
      );
      expect(init.method).toBe('PUT');
      expect(init.body).toBeUndefined();
    });
  });
});
