import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfig {
  token?: string;
}

function configDir(): string {
  const xdgConfigHome = process.env['XDG_CONFIG_HOME'];
  const base = xdgConfigHome ? xdgConfigHome : join(homedir(), '.config');
  return join(base, 'sevdesk');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

export async function readConfig(): Promise<CliConfig> {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8')) as CliConfig;
  } catch {
    return {};
  }
}

export async function writeConfig(config: CliConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export type TokenSource = 'environment' | 'config' | 'none';

export async function resolveToken(): Promise<{
  token?: string;
  source: TokenSource;
}> {
  const environmentToken = process.env['SEVDESK_TOKEN']?.trim();
  if (environmentToken) {
    return { token: environmentToken, source: 'environment' };
  }
  const configToken = (await readConfig()).token?.trim();
  if (configToken) {
    return { token: configToken, source: 'config' };
  }
  return { source: 'none' };
}
