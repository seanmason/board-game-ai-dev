import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,posix} from 'node:path';
import {games,sharedAssets,standaloneGames,suiteAssets} from '../scripts/static-assets.mjs';

test('preview allowlist includes every local module, worker, stylesheet and JSON dependency',()=>{
  const files=new Set([...sharedAssets,...suiteAssets,...Object.values(games).filter(paths=>existsSync(paths[0])).flat()]);
  for(const file of files){
    assert.ok(existsSync(file),`Missing source ${file}`);
    if(!/\.(js|html)$/.test(file))continue;
    const source=readFileSync(file,'utf8');
    const patterns=[
      /(?:from\s*|import\s*)["'](\.[^"']+)["']/g,
      /new URL\(\s*["'](\.[^"']+)["']/g,
      /(?:src|href)=["']([^"']+\.(?:js|css))["']/g
    ];
    for(const regex of patterns)for(const match of source.matchAll(regex)){
      const dependency=posix.normalize(posix.join(dirname(file),match[1]));
      assert.ok(files.has(dependency),`${file} needs unstaged dependency ${dependency}`);
    }
  }
});

import {mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('each standalone package contains a complete local dependency graph and no cross-game navigation',()=>{
  const temp=mkdtempSync(join(tmpdir(),'board-game-package-'));
  try{
    for(const game of standaloneGames.filter(name=>existsSync(games[name][0]))){
      const target=join(temp,game);
      execFileSync(process.execPath,['scripts/package-game.mjs',game,target]);
      assert.ok(existsSync(join(target,'index.html')));
      const paths=readdirSync(target,{recursive:true}).filter(p=>/\.(js|html)$/.test(p));
      for(const path of paths){
        const content=readFileSync(join(target,path),'utf8');
        assert.doesNotMatch(content,/title="Open (Azul|Pentago|Boop)"/);
        assert.doesNotMatch(content,/data-suite-nav/);
        for(const pattern of [/(?:from\s*|import\s*)["'](\.[^"']+)["']/g,
          /new URL\(\s*["'](\.[^"']+)["']/g,/(?:src|href)=["']([^"']+\.(?:js|css))["']/g]){
          for(const match of content.matchAll(pattern)){
            assert.ok(existsSync(join(target,dirname(path),match[1])),`${game}/${path} missing ${match[1]}`);
          }
        }
        if(path.endsWith('.js'))execFileSync(process.execPath,['--check',join(target,path)]);
      }
    }
  }finally{rmSync(temp,{recursive:true,force:true});}
});

// Suite navigation must survive staging while being omitted from standalone games.
test('suite home lists all ten games and preserves a separate Azul entry',()=>{
  const home=readFileSync('index.html','utf8');
  const links=[...home.matchAll(/class="card" href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(links.length,10);
  assert.ok(links.includes('azul.html'));
  for(const href of links)assert.ok(existsSync(href.endsWith('/')?href+'index.html':href),href);
  assert.match(readFileSync('azul.html','utf8'),/src=".\/src\/app.js"/);
  assert.doesNotMatch(home,/Development preview|Experimental base game/);
});
