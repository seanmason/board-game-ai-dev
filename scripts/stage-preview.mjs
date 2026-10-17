import {access, copyFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {games, sharedAssets, optionalGames, suiteAssets} from './static-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(process.argv[2] ?? 'preview');
// Fail if a destination already exists: stale experimental assets must not leak.
try { await access(destination); throw Error('Preview destination already exists; choose a fresh directory'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const assets = [...sharedAssets, ...suiteAssets];
for (const [game, paths] of Object.entries(games)) {
  try { await access(resolve(root, paths[0])); }
  catch (error) { if (optionalGames.includes(game) && error.code === 'ENOENT') continue; throw error; }
  assets.push(...paths);
}
// Preflight every required source before creating output.
await Promise.all(assets.map(path => access(resolve(root, path))));
for (const path of assets) {
  const target = resolve(destination, path);
  await mkdir(dirname(target), {recursive: true});
  await copyFile(resolve(root, path), target);
}
await writeFile(resolve(destination, '.nojekyll'), '');
console.log(`Staged ${assets.length} allowlisted assets in ${destination}`);
