import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL((process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules')+'/playwright/index.mjs').href));
const base=process.env.PATCHWORK_URL??'http://127.0.0.1:8080/patchwork/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1360,height:1000},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('board-game-ai-patchwork-v1'));return d?.history[d.index].state;});
const getNodes=async()=>Number(await page.locator('#nodes').innerText());
try{
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.removeItem('board-game-ai-patchwork-v1'));await page.reload();
 assert.equal(await page.locator('h1').innerText(),'Patchwork');assert.equal(await page.locator('#nodes').count(),0);assert.equal(await state(),undefined);
 await page.locator('#setup-edition').selectOption('original');
 await page.locator('summary').filter({hasText:'Paste an entered order'}).click();
 await page.locator('#ring-input').fill([...Array.from({length:32},(_,i)=>i+2),1].join(','));await page.locator('[data-action=paste-order]').click();
 assert.match(await page.locator('main').innerText(),/33\/33 entered/);await page.locator('[data-action=confirm-setup]').click();
 await page.waitForFunction(()=>Number(document.querySelector('#nodes')?.textContent)>0);assert.equal((await state()).turn,0);
 const start=await state();await page.locator('[data-action=select][data-id="2"]').click();await page.locator('[data-action=rotate]').click();await page.locator('[data-action=flip]').click();
 await page.locator('[data-player="0"][data-cell="0"]').click();assert(await page.locator('.cell.preview').count()>0);assert.deepEqual(await state(),start,'Preview must not change table');
 await page.locator('#place-button').click();assert.equal((await state()).turn,1);
 await page.locator('[data-action=undo]').click();assert.deepEqual(await state(),start);await page.locator('[data-action=redo]').click();const moved=await state();assert.equal(moved.turn,1);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await state(),moved);await page.waitForFunction(()=>Number(document.querySelector('#nodes')?.textContent)>0);
 await page.locator('[data-action=pause]').click();await page.waitForTimeout(250);const paused=await getNodes();await page.waitForTimeout(350);assert.equal(await getNodes(),paused);await page.locator('[data-action=pause]').click();await page.waitForFunction(n=>Number(document.querySelector('#nodes')?.textContent)>n,paused);
 const before=await state();const invalid={format:'board-game-ai-patchwork',version:1,index:0,history:[{label:'bad',state:{...before,currentPlayer:'<img src=x onerror=alert(1)>'}}]};await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.locator('[role=alert]').waitFor();assert.deepEqual(await state(),before,'Malformed import replaces nothing');
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();const download=await downloadPromise;const path=await download.path();const {readFile}=await import('node:fs/promises');const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.format,'board-game-ai-patchwork');
 saved.history[saved.index].label='<img src=x onerror="window.pwned=true">';await page.locator('#import-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>window.pwned),undefined);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Phone horizontal overflow');await page.screenshot({path:'/tmp/patchwork-phone.png',fullPage:true});
 // Exercise earned leather through a valid, engine-generated table transcript.
 const leather=await page.evaluate(async()=>{const c=await import(new URL('./core.js',location.href));let s=c.observeSetup(c.newGame(),[...Array.from({length:32},(_,i)=>i+2),1],'original');while(s.phase!=='leather')s=c.applyAction(s,{type:'advance'});return s;});
 await page.locator('#import-file').setInputFiles({name:'leather.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'board-game-ai-patchwork',version:1,index:0,history:[{label:'Observed time crossing',state:leather}]}))});
 assert.equal((await state()).phase,'leather');await page.locator(`[data-player="${leather.currentPlayer}"][data-cell="40"]`).click();await page.locator('#place-button').click();assert.equal((await state()).phase,'play');assert.equal((await state()).players[leather.currentPlayer].board[40],120);
 await page.setViewportSize({width:1360,height:1000});await page.screenshot({path:'/tmp/patchwork-desktop.png',fullPage:true});
 await page.locator('#mode').selectOption('digital');await page.locator('[data-action=new]').click();assert.equal((await state()).mode,'digital');await page.waitForFunction(()=>Number(document.querySelector('#nodes')?.textContent)>0);assert.equal((await state()).turn,0);await page.locator('[data-action=record-candidate]').first().click();assert((await state()).turn>0|| (await state()).phase==='leather');
 assert.deepEqual(errors,[]);console.log('Patchwork browser passed: actual ring + explicit edition, rotate/flip/tap preview, explicit recording, undo/redo/autosave, worker pause/resume, atomic malformed imports, escaped timeline, export roundtrip, leather placement, responsive phone, digital no-autoplay.');
}finally{await browser.close();}
