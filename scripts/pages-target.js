import { createHash } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const READABLE_PREFIX_LENGTH = 64;
const HASH_LENGTH = 16;

export function previewSlug(branch) {
  const normalized = branch
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  const readable = (!normalized || normalized === '.' || normalized === '..' ? 'branch' : normalized)
    .slice(0, READABLE_PREFIX_LENGTH);
  const hash = createHash('sha256').update(branch).digest('hex').slice(0, HASH_LENGTH);
  return `${readable}-${hash}`;
}

export function pagesTarget(branch) {
  if (branch === 'main') {
    return { base: '/chessview/', target: '.' };
  }

  const slug = previewSlug(branch);
  return {
    base: `/chessview/previews/${slug}/`,
    target: `previews/${slug}`,
  };
}

async function writeGithubOutputs() {
  const branch = process.env.GITHUB_REF_NAME;
  const output = process.env.GITHUB_OUTPUT;
  if (!branch) throw new Error('GITHUB_REF_NAME is required');
  if (!output) throw new Error('GITHUB_OUTPUT is required');

  const { base, target } = pagesTarget(branch);
  await appendFile(output, `base=${base}\ntarget=${target}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeGithubOutputs().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
