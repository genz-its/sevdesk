import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configPath,
  readConfig,
  resolveToken,
  writeConfig,
} from '../src/config';

describe('config', () => {
  beforeEach(async () => {
    vi.stubEnv(
      'XDG_CONFIG_HOME',
      await mkdtemp(join(tmpdir(), 'sevdesk-cli-')),
    );
    vi.stubEnv('SEVDESK_TOKEN', '');
    delete process.env['SEVDESK_TOKEN'];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('places the config file in XDG_CONFIG_HOME', () => {
    expect(configPath()).toBe(
      join(process.env['XDG_CONFIG_HOME'] as string, 'sevdesk', 'config.json'),
    );
  });

  it('returns an empty config when no file exists', async () => {
    expect(await readConfig()).toEqual({});
  });

  it('round-trips the config file', async () => {
    await writeConfig({ token: 'abc' });
    expect(await readConfig()).toEqual({ token: 'abc' });
  });

  it('resolves the token from the environment first', async () => {
    await writeConfig({ token: 'from-config' });
    vi.stubEnv('SEVDESK_TOKEN', 'from-env');
    expect(await resolveToken()).toEqual({
      token: 'from-env',
      source: 'environment',
    });
  });

  it('falls back to the config file token', async () => {
    await writeConfig({ token: 'from-config' });
    expect(await resolveToken()).toEqual({
      token: 'from-config',
      source: 'config',
    });
  });

  it('reports a missing token', async () => {
    expect(await resolveToken()).toEqual({ source: 'none' });
  });
});
