import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = resolve(process.argv[2] ?? join(root, 'release-artifacts'));
const cli = JSON.parse(
  await readFile(join(root, 'packages/cli/package.json'), 'utf8'),
);
const sdk = JSON.parse(
  await readFile(join(root, 'packages/sdk/package.json'), 'utf8'),
);
/** Installed package directory per tarball kind, derived from the package names. */
const packageNames = { sdk: sdk.name, cli: cli.name };
for (const line of (await readFile(join(artifacts, 'SHA256SUMS'), 'utf8'))
  .trim()
  .split('\n')) {
  const [expected, name] = line.split('  ');
  assert.match(name, /^sevdesk-(cli|sdk)-\d+\.\d+\.\d+\.tgz$/);
  assert.equal(
    createHash('sha256')
      .update(await readFile(join(artifacts, name)))
      .digest('hex'),
    expected,
  );
}
const staging = await mkdtemp(join(tmpdir(), 'sevdesk-install-'));
try {
  const env = {
    ...process.env,
    CI: '1',
    SEVDESK_TOKEN: '',
    XDG_CONFIG_HOME: staging,
    NO_COLOR: '1',
  };
  for (const kind of ['sdk', 'cli']) {
    const prefix = join(staging, kind);
    await exec(
      'npm',
      [
        'install',
        '--prefix',
        prefix,
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        join(artifacts, `sevdesk-${kind}-${cli.version}.tgz`),
      ],
      { cwd: staging, env },
    );
    const installed = JSON.parse(
      await readFile(
        join(prefix, 'node_modules', packageNames[kind], 'package.json'),
        'utf8',
      ),
    );
    assert.equal(installed.version, cli.version);
    assert.equal(
      await readFile(
        join(prefix, 'node_modules', packageNames[kind], 'LICENSE'),
        'utf8',
      ),
      await readFile(join(root, 'LICENSE'), 'utf8'),
    );
  }
  const cliRoot = join(staging, 'cli/node_modules/@mi-skam/sevdesk');
  const bundledSdk = JSON.parse(
    await readFile(
      join(cliRoot, 'node_modules/@mi-skam/sevdesk-sdk/package.json'),
      'utf8',
    ),
  );
  assert.equal(bundledSdk.version, cli.version);
  assert.equal(
    await readFile(
      join(cliRoot, 'node_modules/@mi-skam/sevdesk-sdk/LICENSE'),
      'utf8',
    ),
    await readFile(join(root, 'LICENSE'), 'utf8'),
  );
  const bin = join(cliRoot, 'dist/index.js');
  const run = async (...args) =>
    (await exec(process.execPath, [bin, ...args], { cwd: staging, env }))
      .stdout;
  assert.match(
    await run('--version'),
    new RegExp(cli.version.replaceAll('.', '\\.')),
  );
  for (const command of [
    'invoices:send',
    'invoices:update',
    'invoices:delete',
    'quotes:create',
  ])
    assert.match(await run(command, '--help'), new RegExp(command));
  const input = join(staging, 'invoice.json');
  await writeFile(
    input,
    JSON.stringify({ invoice: { headText: '<p>ACME release smoke test</p>' } }),
  );
  const preview = JSON.parse(
    await run('invoices:update', '9001', input, '--dry-run', '--json'),
  );
  assert.equal(preview.dryRun, true);
  assert.equal(
    preview.payload.invoice.headText,
    '<p>ACME release smoke test</p>',
  );
  console.log(
    `Verified checksums, isolated SDK/CLI installation, bundled SDK ${cli.version}, and offline command smoke tests.`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
