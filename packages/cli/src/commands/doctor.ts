import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { createClient } from '../client';
import { resolveToken } from '../config';
import { formatError } from '../errors';
import { printJson } from '../output';
import { pkg } from '../package';

export default defineCommand({
  description: 'Check the CLI setup and the connection to the sevdesk API.',
  options: defineOptions(
    z.object({
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const { token, source } = await resolveToken();
    let bookkeepingSystemVersion: string | undefined;
    let apiError: string | undefined;
    if (token) {
      try {
        bookkeepingSystemVersion =
          await createClient(token).basics.getBookkeepingSystemVersion();
      } catch (error) {
        apiError = formatError(error);
      }
    }
    if (options.json) {
      printJson({
        cliVersion: pkg.version,
        nodeVersion: process.version,
        tokenSource: source,
        bookkeepingSystemVersion: bookkeepingSystemVersion ?? null,
        apiError: apiError ?? null,
      });
    } else {
      consola.info(`CLI version: ${pkg.version}`);
      consola.info(`Node.js version: ${process.version}`);
      consola.info(`Token source: ${source}`);
      if (!token) {
        consola.warn(
          'No API token found. Run `sevdesk login` or set the SEVDESK_TOKEN environment variable.',
        );
      } else if (apiError) {
        consola.error(`API connection failed: ${apiError}`);
      } else {
        consola.success(
          `API connection succeeded. Bookkeeping system version: ${bookkeepingSystemVersion}`,
        );
      }
    }
    if (bookkeepingSystemVersion === '1.0') {
      consola.warn(
        'This sevdesk account still uses bookkeeping system version 1.0, which is not supported.',
      );
      process.exitCode = 1;
    } else if (!token || apiError) {
      process.exitCode = 1;
    }
  },
});
