import { execFile } from 'node:child_process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] ?? join(root, 'release-artifacts'));
const load = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sdk = await load(join(root, 'packages/sdk/package.json'));
const cli = await load(join(root, 'packages/cli/package.json'));
if (sdk.version !== cli.version || cli.dependencies[sdk.name] !== sdk.version)
  throw new Error(
    'SDK, CLI and the pinned SDK dependency must share the release version.',
  );
if (
  process.env['GITHUB_REF_TYPE'] === 'tag' &&
  process.env['GITHUB_REF_NAME'] !== `v${cli.version}`
)
  throw new Error('Tag must match the package versions.');

await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), 'sevdesk-release-'));
async function pack(cwd, target) {
  const { stdout } = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', output],
    { cwd },
  );
  const [result] = JSON.parse(stdout);
  await rename(join(output, result.filename), join(output, target));
  return result;
}
try {
  const sdkName = `sevdesk-sdk-${sdk.version}.tgz`;
  const cliName = `sevdesk-cli-${cli.version}.tgz`;
  const sdkStage = join(staging, 'sdk');
  await mkdir(sdkStage);
  for (const entry of [...sdk.files, 'README.md', 'package.json'])
    await cp(join(root, 'packages/sdk', entry), join(sdkStage, entry), {
      recursive: true,
    });
  await cp(join(root, 'LICENSE'), join(sdkStage, 'LICENSE'));
  await pack(sdkStage, sdkName);

  const cliDir = join(staging, 'cli');
  await mkdir(cliDir);
  for (const entry of [...cli.files, 'README.md'])
    await cp(join(root, 'packages/cli', entry), join(cliDir, entry), {
      recursive: true,
    });
  await cp(join(root, 'LICENSE'), join(cliDir, 'LICENSE'));
  // Bundle the exact SDK tarball, not the upstream registry package or a workspace symlink.
  const sdkDir = join(cliDir, 'node_modules', sdk.name);
  await mkdir(sdkDir, { recursive: true });
  await exec('tar', [
    '-xzf',
    join(output, sdkName),
    '-C',
    sdkDir,
    '--strip-components=1',
  ]);
  const manifest = { ...cli, bundledDependencies: [sdk.name] };
  delete manifest.scripts;
  await writeFile(
    join(cliDir, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const packed = await pack(cliDir, cliName);
  if (!packed.bundled?.includes(sdk.name))
    throw new Error('CLI archive is missing its bundled SDK.');

  const checksums = [];
  for (const name of [sdkName, cliName]) {
    const hash = createHash('sha256')
      .update(await readFile(join(output, name)))
      .digest('hex');
    checksums.push(`${hash}  ${name}`);
  }
  await writeFile(join(output, 'SHA256SUMS'), checksums.join('\n') + '\n');
  console.log(
    `Created SDK and CLI ${cli.version} archives with SHA256SUMS in ${output}.`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
