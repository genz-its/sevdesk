import { SevDesk } from '@genz-its/sevdesk-sdk';
import { consola } from 'consola';
import { resolveToken } from './config';
import { pkg } from './package';

export function createClient(token: string): SevDesk {
  return new SevDesk({ token, userAgent: `${pkg.name}/${pkg.version}` });
}

/**
 * Resolves the API token and returns a ready-to-use client. Exits with an
 * explanation when no token is available.
 */
export async function requireClient(): Promise<SevDesk> {
  const { token } = await resolveToken();
  if (!token) {
    consola.error(
      'You must be logged in. Run `sevdesk login` or set the SEVDESK_TOKEN environment variable.',
    );
    process.exit(1);
  }
  return createClient(token);
}
