#!/usr/bin/env node
import { defineConfig, processConfig } from '@robingenz/zli';
import { consola } from 'consola';
import accountsBalance from './commands/accounts/balance';
import accountsCreateClearing from './commands/accounts/create-clearing';
import accountsCreateFileImport from './commands/accounts/create-file-import';
import accountsGet from './commands/accounts/get';
import accountsList from './commands/accounts/list';
import contactsCreate from './commands/contacts/create';
import contactsDelete from './commands/contacts/delete';
import contactsGet from './commands/contacts/get';
import contactsList from './commands/contacts/list';
import contactsUpdate from './commands/contacts/update';
import creditNotesGet from './commands/credit-notes/get';
import creditNotesList from './commands/credit-notes/list';
import creditNotesPdf from './commands/credit-notes/pdf';
import doctor from './commands/doctor';
import exportContacts from './commands/export/contacts';
import exportDatev from './commands/export/datev';
import exportInvoices from './commands/export/invoices';
import exportTransactions from './commands/export/transactions';
import exportVouchers from './commands/export/vouchers';
import guidanceAccounts from './commands/guidance/accounts';
import invoicesGet from './commands/invoices/get';
import invoicesList from './commands/invoices/list';
import invoicesPdf from './commands/invoices/pdf';
import login from './commands/login';
import logout from './commands/logout';
import ordersGet from './commands/orders/get';
import ordersList from './commands/orders/list';
import ordersPdf from './commands/orders/pdf';
import partsGet from './commands/parts/get';
import partsList from './commands/parts/list';
import tagsCreate from './commands/tags/create';
import tagsDelete from './commands/tags/delete';
import tagsList from './commands/tags/list';
import transactionsCreate from './commands/transactions/create';
import transactionsGet from './commands/transactions/get';
import transactionsList from './commands/transactions/list';
import vouchersBook from './commands/vouchers/book';
import vouchersCreate from './commands/vouchers/create';
import vouchersEnshrine from './commands/vouchers/enshrine';
import vouchersGet from './commands/vouchers/get';
import vouchersList from './commands/vouchers/list';
import vouchersResetToDraft from './commands/vouchers/reset-to-draft';
import vouchersResetToOpen from './commands/vouchers/reset-to-open';
import { formatError } from './errors';
import { pkg } from './package';

const config = defineConfig({
  meta: {
    name: 'sevdesk',
    version: pkg.version,
    description: pkg.description,
  },
  commands: {
    login,
    logout,
    doctor,
    'accounts:balance': accountsBalance,
    'accounts:create-clearing': accountsCreateClearing,
    'accounts:create-file-import': accountsCreateFileImport,
    'accounts:get': accountsGet,
    'accounts:list': accountsList,
    'contacts:create': contactsCreate,
    'contacts:delete': contactsDelete,
    'contacts:get': contactsGet,
    'contacts:list': contactsList,
    'contacts:update': contactsUpdate,
    'credit-notes:get': creditNotesGet,
    'credit-notes:list': creditNotesList,
    'credit-notes:pdf': creditNotesPdf,
    'export:contacts': exportContacts,
    'export:datev': exportDatev,
    'export:invoices': exportInvoices,
    'export:transactions': exportTransactions,
    'export:vouchers': exportVouchers,
    'guidance:accounts': guidanceAccounts,
    'invoices:get': invoicesGet,
    'invoices:list': invoicesList,
    'invoices:pdf': invoicesPdf,
    'orders:get': ordersGet,
    'orders:list': ordersList,
    'orders:pdf': ordersPdf,
    'parts:get': partsGet,
    'parts:list': partsList,
    'tags:create': tagsCreate,
    'tags:delete': tagsDelete,
    'tags:list': tagsList,
    'transactions:create': transactionsCreate,
    'transactions:get': transactionsGet,
    'transactions:list': transactionsList,
    'vouchers:book': vouchersBook,
    'vouchers:create': vouchersCreate,
    'vouchers:enshrine': vouchersEnshrine,
    'vouchers:get': vouchersGet,
    'vouchers:list': vouchersList,
    'vouchers:reset-to-draft': vouchersResetToDraft,
    'vouchers:reset-to-open': vouchersResetToOpen,
  },
});

try {
  const result = processConfig(config, process.argv.slice(2));
  await result.command.action(result.options, result.args);
} catch (error) {
  consola.error(formatError(error));
  process.exitCode = 1;
}
