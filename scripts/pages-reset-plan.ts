import { pathToFileURL } from 'node:url';
import { pagesTarget } from './pages-target.ts';

export function resetPagesPlan(branches: readonly string[]) {
  const liveBranches = [...new Set(branches.filter(Boolean))].filter((branch) => branch !== 'gh-pages');
  if (!liveBranches.includes('main')) throw new Error('main branch is required');

  return liveBranches
    .sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map((branch) => ({ branch, ...pagesTarget(branch) }));
}

async function readStdin(): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function writePlan(): Promise<void> {
  const input = await readStdin();
  const branches = input.split('\n').filter(Boolean);
  for (const { branch, base, target } of resetPagesPlan(branches)) {
    process.stdout.write(`${branch}\t${base}\t${target}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writePlan().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
