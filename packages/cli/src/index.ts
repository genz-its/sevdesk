#!/usr/bin/env node
import { defineConfig, processConfig } from '@robingenz/zli';
import { consola } from 'consola';
import accountsBalance from './commands/accounts/balance';
import accountsCreateClearing from './commands/accounts/create-clearing';
import accountsCreateFileImport from './commands/accounts/create-file-import';
import accountsGet from './commands/accounts/get';
import accountsList from './commands/accounts/list';
import doctor from './commands/doctor';
import guidanceAccounts from './commands/guidance/accounts';
import login from './commands/login';
import logout from './commands/logout';
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
    'guidance:accounts': guidanceAccounts,
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
