import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {newGame,owner,applyAction,legalActions,actionKey} from '../boop/core.js';
import {positionKey} from '../boop/ai.js';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base=process.env.BOOP_BROWSER_URL??'http://127.0.0.1:8080/boop/';
const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon'))errors.push(e.text());});
const button=a=>page.locator(`[data-action="${a}"]`);
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('board-game-ai-boop-v1')));
const sim=()=>page.locator('#simulations').innerText().then(t=>Number(t.replaceAll(',','')));
async function waitSims(n=0){await page.waitForFunction(n=>Number(document.querySelector('#simulations')?.textContent.replaceAll(',',''))>n,n,{timeout:45000});}
async function load(state){const file={format:'board-game-ai-boop',version:1,history:[{state,label:'Browser fixture'}],index:0,seats:['human','ai']};await page.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(file))});await page.waitForFunction(ply=>document.querySelector('[role="alert"]')===null&&JSON.parse(localStorage.getItem('board-game-ai-boop-v1'))?.history[0].state.ply===ply,state.ply);}
function fixture(entries,cats=[0,0]){const s=newGame();for(const [i,v] of entries)s.board[i]=v;s.pools=[0,1].map(p=>[8-cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===1).length,cats[p]-s.board.filter(v=>owner(v)===p&&Math.abs(v)===2).length]);return s;}
let server=null,standalone=null;
try{
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').innerText(),'Boop');
  assert.equal(await page.locator('.quilt:not(.preview-board) .cell').count(),36);assert.equal(await page.locator('.rules details').evaluate(e=>e.open),false);
  await button('new-game').click();
  const initial=JSON.stringify((await stored()).history);
  await page.locator('.cell[data-cell="14"]').click();assert.ok(await page.locator('.preview-board').count());
  assert.equal(JSON.stringify((await stored()).history),initial,'Preview must not alter physical history');
  await button('confirm').click();assert.match(await page.locator('#turn-status').innerText(),/Gray to play/);assert.equal((await stored()).history[1].state.board[14],1);
  await button('undo').click();assert.equal((await stored()).index,0);await button('redo').click();assert.equal((await stored()).index,1);
  await page.reload({waitUntil:'networkidle'});assert.equal((await stored()).index,1);assert.match(await page.locator('#turn-status').innerText(),/Gray/);
  await waitSims();
  if(await button('pause').innerText()==='Pause')await button('pause').click();
  await page.waitForTimeout(700);const paused=await sim();await page.waitForTimeout(500);assert.equal(await sim(),paused,'Paused count is stable');
  await button('pause').click();await waitSims(paused);await button('pause').click();await page.waitForTimeout(700);
  const countBefore=await sim(),beforeHover=JSON.stringify((await stored()).history);
  await page.locator('tr[data-candidate]').first().hover();assert.equal(await page.locator('.quilt:not(.preview-board) .hover-cell').count(),1);assert.equal(JSON.stringify((await stored()).history),beforeHover);
  await page.locator('h1').hover();assert.equal(await page.locator('.quilt:not(.preview-board) .hover-cell').count(),0);
  await page.locator('tr[data-candidate] button').first().click();assert.equal(await page.locator('.quilt:not(.preview-board) .hover-cell').count(),1);
  // A variation changes only the analysis branch, including export/autosave authority.
  const actual=JSON.stringify((await stored()).history);await button('branch').click();assert.match(await page.locator('#turn-status').innerText(),/HYPOTHETICAL/);assert.equal(JSON.stringify((await stored()).history),actual);
  await button('return').click();assert.equal(JSON.stringify((await stored()).history),actual);assert.doesNotMatch(await page.locator('#turn-status').innerText(),/HYPOTHETICAL/);
  if(await button('pause').innerText()==='Resume')await button('pause').click();
  await waitSims();await button('pause').click();await page.waitForTimeout(650);
  const beforeReroot=await sim();await button('record-best').click();assert.equal((await stored()).history[(await stored()).index].state.ply,2);
  assert.match(await page.locator('#coverage').innerText(),/Retained/);assert.ok(await sim()<=beforeReroot||await sim()===0,'Only conditioned visits are retained');
  const beforeExtra=await sim();await page.locator('[data-action="more"][data-count="250"]').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent==='Paused',null,{timeout:45000});
  assert.ok(await sim()>=beforeExtra+250,'Extra simulations accumulate');
  // Reject malformed session without touching autosave; recover with valid import.
  const beforeBad=await stored(),bad=structuredClone(beforeBad);bad.index=0.5;
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
  await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/history position/);assert.deepEqual(await stored(),beforeBad);
  // All promotion options, including cat retrieval with eight pieces, are exposed.
  const f=fixture([[0,2],[2,1],[4,1],[12,1],[13,1],[14,1],[30,1]],[1,0]);await load(f);
  await page.locator('.quilt:not(.preview-board) .cell[data-cell="35"]').click();assert.equal(await button('choice').count(),9);
  await page.getByRole('button',{name:'Retrieve / graduate A1',exact:true}).click();await button('confirm').click();
  const retrieval=(await stored()).history[1].state;assert.equal(retrieval.pools[0][1],1);assert.equal(retrieval.board[0],0);assert.equal(retrieval.board[2],1);
  // Real imported history reaches workers and aggregation, excluding redo future.
  const archived=JSON.parse(readFileSync(new URL('../benchmarks/boop-long/tactical-10000.json',import.meta.url),'utf8')).records.find(r=>r.game===11);
  let cycleState=newGame({mode:'digital'});const cycleHistory=[{state:cycleState,label:'Start'}];
  for(const action of [...archived.opening,...archived.moves.filter(m=>m.ply<35).map(m=>m.action)]){cycleState=applyAction(cycleState,action);cycleHistory.push({state:cycleState,label:'Recorded move'});}
  const futureAction=legalActions(cycleState).find(a=>!cycleHistory.some(h=>positionKey(h.state)===positionKey(applyAction(cycleState,a)))),future=applyAction(cycleState,futureAction);
  const cycleSession={format:'board-game-ai-boop',version:1,history:[...cycleHistory,{state:future,label:'Redo future'}],index:cycleHistory.length-1,seats:['human','ai']};
  await page.locator('#import-file').setInputFiles({name:'cycle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cycleSession))});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('board-game-ai-boop-v1'))?.index===35);
  await page.locator('[data-action="more"][data-count="1000"]').click();
  await page.waitForFunction(()=>document.querySelector('#analysis-status')?.textContent==='Paused',null,{timeout:45000});
  const bestKey=await page.locator('tr[data-candidate]').first().getAttribute('data-candidate'),suggestion=legalActions(cycleState).find(a=>actionKey(a)===bestKey);
  assert.ok(suggestion);assert.ok(!cycleHistory.some(h=>positionKey(h.state)===positionKey(applyAction(cycleState,suggestion))));
  assert.ok(await page.getByText('Returns to a position seen 1 time',{exact:true}).count());
  assert.doesNotMatch(await page.locator(`tr[data-candidate="${actionKey(futureAction)}"]`).innerText(),/Returns to a position/,'Redo future does not count as visited');
  assert.equal((await stored()).index,35,'Repetition analysis does not record a move');
  // Win terminal result and new-game reset remain usable.
  await load(fixture([[12,2],[13,2]],[3,0]));await page.locator('[data-action="piece"][data-piece="2"]').click();await page.locator('.quilt:not(.preview-board) [data-cell="14"]').click();await button('confirm').click();assert.match(await page.locator('#turn-status').innerText(),/Orange wins/);
  await page.locator('#mode').selectOption('digital');await button('new-game').click();await page.locator('[data-action="seat"][data-seat="0"]').selectOption('ai');
  const aiBefore=(await stored()).history.length;await page.waitForTimeout(1100);assert.equal((await stored()).history.length,aiBefore,'AI never autoplays');
  if(await button('pause').innerText()==='Resume')await button('pause').click();await waitSims();await button('record-best').click();assert.equal((await stored()).history.length,aiBefore+1);
  mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/boop-desktop.png',fullPage:true});
  for(const width of [768,390]){
    const touch=await browser.newPage({viewport:{width,height:1024},hasTouch:true,isMobile:true,deviceScaleFactor:2});touch.on('pageerror',e=>errors.push(e.message));
    await touch.goto(base,{waitUntil:'networkidle'});const overflow=await touch.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=2,`Viewport ${width}: horizontal overflow ${overflow}`);
    await touch.locator('.quilt:not(.preview-board) [data-cell="14"]').tap();await touch.locator('[data-action="confirm"]').tap();assert.match(await touch.locator('#turn-status').innerText(),/Gray/);
    await touch.screenshot({path:`test-artifacts/boop-${width}.png`,fullPage:true});await touch.close();
  }
  // Standalone game really launches its relocated Web Worker and persists moves.
  standalone=mkdtempSync(join(tmpdir(),'boop-browser-'));const output=join(standalone,'site');execFileSync(process.execPath,['scripts/package-game.mjs','boop',output]);
  server=spawn('python3',['-m','http.server','8081','--bind','127.0.0.1','--directory',output],{stdio:'ignore'});
  const single=await browser.newPage();single.on('pageerror',e=>errors.push(e.message));
  for(let n=0;n<20;n++){try{await single.goto('http://127.0.0.1:8081/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  await single.waitForFunction(()=>Number(document.querySelector('#simulations')?.textContent.replaceAll(',',''))>0,null,{timeout:45000});assert.equal(await single.locator('a[title^="Open "]').count(),0);await single.close();
  assert.deepEqual(errors,[]);console.log('Boop browser PASS: physical preview/record, all graduations, cat retrieval, win, worker pause/resume/reuse, extra simulations, variation isolation, import rejection/recovery, explicit AI turn, autosave, touch layouts, standalone worker.');
}finally{if(server)server.kill();await browser.close();if(standalone)rmSync(standalone,{recursive:true,force:true});}
