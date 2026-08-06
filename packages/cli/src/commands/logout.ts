import { consola } from 'consola';
import { defineCommand } from 'zodline';
import { readConfig, writeConfig } from '../config';

export default defineCommand({
  description: 'Log out by removing the stored API token.',
  action: async () => {
    const { token, ...config } = await readConfig();
    if (!token) {
      consola.info('You are not logged in.');
    } else {
      await writeConfig(config);
      consola.success('Logged out.');
    }
    if (process.env['SEVDESK_TOKEN']) {
      consola.warn(
        'The SEVDESK_TOKEN environment variable is still set and will be used for authentication.',
      );
    }
  },
});
