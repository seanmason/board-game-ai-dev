import {execFileSync} from 'node:child_process';
// Tracked files plus new source files; excludes node_modules, build outputs and git internals.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {encoding:'utf8'})
  .trim().split('\n').filter(path => /\.(?:m?js)$/.test(path));
for (const file of files) execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
console.log(`Syntax checked ${files.length} JavaScript modules`);
