// Build one dependency-free, self-contained game directory for static hosting.
// This only prepares files; publication to the release repository stays manual.
import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {games,sharedAssets} from './static-assets.mjs';
const [game,directory]=process.argv.slice(2);
if(!['azul','pentago','splendor'].includes(game)||!directory)
  throw Error('Usage: node scripts/package-game.mjs azul|pentago|splendor NEW_OUTPUT_DIRECTORY');
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=resolve(directory);
try{await access(destination);throw Error('Output directory already exists');}
catch(error){if(error.code!=='ENOENT')throw error;}
const files=[...games[game],...sharedAssets];
await Promise.all(files.map(file=>access(resolve(root,file))));
for(const file of files){
  let content=await readFile(resolve(root,file),'utf8');
  const relative=game!=='azul'?file.replace(new RegExp('^'+game+'/'),''):file;
  if(game!=='azul'&&file.startsWith(game+'/')){
    content=content.replaceAll('../shared/','./shared/');
    // Suite-only navigation is omitted from a standalone game.
    content=content.replace(/<a href="\.\.\/" title="Open Azul">Azul ↗<\/a>/g,'');
  }
  if(game==='azul'&&file==='src/app.js'){
    content=content.replace(/<a href="\.\/pentago\/" title="Open Pentago">Pentago ↗<\/a>/g,'');
  }
  const target=resolve(destination,relative);
  await mkdir(dirname(target),{recursive:true});await writeFile(target,content);
}
await writeFile(resolve(destination,'.nojekyll'),'');
console.log(`Packaged standalone ${game} at ${destination}`);
