import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** Private, exclusive send receipt: never overwrite a previous operation or retry a POST. */
export async function reserveSendReceipt(path?: string) {
  const target = resolve(
    path ??
      join(
        process.env['XDG_STATE_HOME'] || join(homedir(), '.local/state'),
        'sevdesk',
        'invoices',
        `${randomUUID()}.json`,
      ),
  );
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, JSON.stringify({ state: 'reserved' }) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  return {
    path: target,
    async update(result: {
      state: string;
      invoiceId: string;
      [key: string]: unknown;
    }) {
      const temp = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify(result, null, 2) + '\n', {
          flag: 'wx',
          mode: 0o600,
        });
        await rename(temp, target);
      } catch {
        throw new Error(
          `Could not update operation receipt ${target}. Last known state: ${result.state}; invoice ID ${result.invoiceId}. Inspect sevdesk before retrying.`,
        );
      }
    },
  };
}
