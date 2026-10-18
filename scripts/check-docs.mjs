// Lightweight check for maintained entry points. Historical evidence stays untouched.
import {readFile, readdir, stat} from 'node:fs/promises';
import {dirname, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {standaloneGames} from './static-assets.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(resolve(root, directory), {withFileTypes: true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}
const files = ['AGENTS.md', 'README.md', 'docs/INDEX.md', 'docs/DOCUMENTATION.md',
  'docs/ARCHITECTURE.md', 'docs/PREVIEW_DEPLOYMENT.md', 'benchmarks/README.md',
  ...await markdownFiles('docs/games'), ...await markdownFiles('docs/platform'),
  ...await markdownFiles('docs/decisions'), ...await markdownFiles('docs/work'),
  ...await markdownFiles('docs/plans'),
  'docs/templates/README.md'];
for (const file of files) {
  const source = (await readFile(resolve(root, file), 'utf8')).replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '');
  // Maintained documents use inline Markdown links; fragments and remote URLs
  // deliberately remain outside this offline file-existence check.
  for (const match of source.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const target = match[1].trim();
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
    const path = target.split(/[?#]/)[0];
    if (!path) continue;
    const absolute = resolve(dirname(resolve(root, file)), path);
    if (relative(root, absolute).startsWith('..')) {
      failures.push(`${file}: link leaves repository: ${target}`); continue;
    }
    try { await stat(absolute); }
    catch { failures.push(`${file}: missing link target: ${target}`); }
  }
}
const index = await readFile(resolve(root, 'docs/games/INDEX.md'), 'utf8');
for (const game of standaloneGames) {
  try { await stat(resolve(root, `docs/games/${game}/README.md`)); }
  catch { failures.push(`Missing overview for packaged game: ${game}`); }
  if (!index.includes(`(${game}/README.md)`)) failures.push(`Game index missing: ${game}`);
}
if (failures.length) {
  console.error(failures.join('\n')); process.exitCode = 1;
} else console.log(`Documentation check passed: ${files.length} files; ${standaloneGames.length} packaged game entry points. External URLs, fragments and prose claims are not checked.`);
