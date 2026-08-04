import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { createClient } from '../client';
import { configPath, readConfig, writeConfig } from '../config';
import { isInteractive } from '../interactive';
import { promptText } from '../prompt';

export default defineCommand({
  description: 'Log in with your sevdesk API token.',
  options: defineOptions(
    z.object({
      token: z
        .string()
        .optional()
        .describe('The sevdesk API token. If omitted, you will be prompted.'),
    }),
  ),
  action: async (options) => {
    let token = options.token?.trim();
    if (!token) {
      if (!isInteractive()) {
        consola.error(
          'You must provide a token via --token when running in a non-interactive environment.',
        );
        process.exit(1);
      }
      consola.info(
        'You can find your API token in sevdesk under Settings > User > API token.',
      );
      token = (await promptText('Enter your sevdesk API token:')).trim();
    }
    const client = createClient(token);
    const version = await client.basics.getBookkeepingSystemVersion();
    if (version === '1.0') {
      consola.error(
        'This sevdesk account still uses bookkeeping system version 1.0, which is not supported. Please update your account to sevdesk-Update 2.0.',
      );
      process.exit(1);
    }
    await writeConfig({ ...(await readConfig()), token });
    consola.success(`Logged in. Token stored in ${configPath()}.`);
  },
});
