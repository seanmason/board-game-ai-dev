import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.BASE_URL??'http://127.0.0.1:8080').replace(/\/$/,'')+'/',url=new URL('love-letter/',base).href;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));mkdirSync('test-artifacts',{recursive:true});
const state=()=>page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('board-game-ai-love-letter-v1'));return d.history[d.index].state;});
const click=action=>page.locator(`[data-action="${action}"]`).click();
const chooseGuard=async()=>{const option=await page.locator('#action-choice option').evaluateAll(options=>options.find(o=>o.textContent.includes('guess 8')).value);await page.locator('#action-choice').selectOption(option);await click('preview');};
try{
 await page.goto(url,{waitUntil:'networkidle'});assert.equal(await page.locator('h1').innerText(),'Love Letter');assert.equal(await page.locator('a[data-suite-nav][href="../index.html"]').innerText(),'Games');
 assert.notEqual(await page.locator('[data-action=shield]').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','Private controls remain legible on white backgrounds');
 await page.locator('#exclusion-0').selectOption('1');await page.locator('#exclusion-1').selectOption('1');await page.locator('#exclusion-2').selectOption('2');await click('setup');
 await click('shield');await page.getByText('Enter or correct my actual hand',{exact:true}).click();await page.locator('#hand-ranks').fill('4');await click('hand');await click('draw');
 await page.getByText('Enter or correct my actual hand',{exact:true}).click();await page.locator('#hand-ranks').fill('4,1');await click('hand');
 await page.waitForFunction(()=>Number(document.querySelector('#samples')?.textContent)>0);
 const privateChoices=await page.locator('#action-choice option').allTextContents();
 await click('shield');const publicChoices=await page.locator('#action-choice option').allTextContents();assert.ok(publicChoices.length>privateChoices.length,'Shielded physical recording does not disclose known hand through choices');
 await page.locator('#viewer').selectOption('1');await click('shield');assert.deepEqual(await page.locator('#action-choice option').allTextContents(),publicChoices,'Another viewer gets the same public declaration choices');
 await page.locator('#viewer').selectOption('0');await click('shield');
 const before=await state();await chooseGuard();assert.deepEqual(await state(),before,'Preview cannot mutate the table');await click('confirm');assert.equal((await state()).phase,'resolve');
 await page.reload({waitUntil:'networkidle'});assert.equal((await state()).phase,'resolve');assert.equal(await page.locator('.playing-card').count(),0,'Reload shields private view');
 await click('cancel');assert.equal((await state()).phase,'choosePlay');await click('undo');assert.equal((await state()).phase,'resolve');await click('redo');assert.equal((await state()).phase,'choosePlay');
 await chooseGuard();await click('confirm');await page.locator('#hit').selectOption('false');await click('effect');assert.equal((await state()).current,1);assert.equal(await page.locator('.playing-card').count(),0,'Handoff shields the previous actor');
 const preserved=await state();await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'board-game-ai-love-letter',version:1,history:[{state:preserved,label:'Bad index'}],index:.5}))});await page.getByRole('alert').filter({hasText:'Invalid session history position'}).waitFor();assert.deepEqual(await state(),preserved);
 await page.getByText('New match · classic sixteen-card rules',{exact:true}).click();await page.locator('#mode').selectOption('digital');await click('new');await click('draw');
 await page.locator('#viewer').selectOption('1');await click('shield');assert.equal(await page.locator('#action-choice').count(),0,'Revealing another digital viewer must not reveal actor action cards');assert.equal(await page.locator('[data-action="candidate"]').count(),0);
 await page.locator('#viewer').selectOption('0');await page.evaluate(()=>{document.querySelector('[data-action="shield"]').click();document.querySelector('[data-action="pause"]').click();});
 await page.waitForTimeout(500);const paused=await page.locator('#samples').innerText();await page.waitForTimeout(350);assert.equal(await page.locator('#samples').innerText(),paused);await click('pause');await page.waitForFunction(n=>Number(document.querySelector('#samples')?.textContent)>n,Number(paused));
 const unchanged=await state();await page.locator('[data-action="candidate"]').first().click();assert.deepEqual(await state(),unchanged);await page.screenshot({path:'test-artifacts/love-letter-desktop.png',fullPage:true});await click('confirm');assert.notDeepEqual(await state(),unchanged);
 const ending=await page.evaluate(async()=>{
  const {newGame,applyAction,legalActions}=await import('./core.js');const {label}=await import('./ai.js');let s=newGame({mode:'digital',seed:23});
  for(let i=0;i<1000;i++){const action=legalActions(s)[0],next=applyAction(s,action);if(next.phase==='gameover')return {state:s,label:label(action)};s=next;}throw Error('Ending fixture cap');
 });
 await page.locator('#import-file').setInputFiles({name:'last-turn.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'board-game-ai-love-letter',version:1,history:[{state:ending.state,label:'Final match turn'}],index:0}))});
 await click('shield');await page.locator('#action-choice').selectOption({label:ending.label});await click('preview');await click('confirm');assert.equal((await state()).phase,'gameover');assert.match(await page.locator('#turn-status').innerText(),/Match won/);
 const downloadPromise=page.waitForEvent('download');await click('export');const download=await downloadPromise;await page.locator('#import-file').setInputFiles(await download.path());assert.equal((await state()).phase,'gameover');await click('undo');assert.equal((await state()).phase,'choosePlay');assert.equal(await page.locator('.playing-card').count(),0,'History navigation shields private view');
 for(const [name,width,height] of [['tablet',820,1110],['phone',390,844],['landscape',844,390]]){
  const touch=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});touch.on('pageerror',e=>errors.push(e.message));await touch.goto(url,{waitUntil:'networkidle'});assert.ok(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),name+' horizontal overflow');await touch.locator('[data-action="setup"]').tap();await touch.locator('[data-action="draw"]').tap();assert.equal(await touch.locator('#action-choice').count(),1,'Public unknown-hand recording is available');await touch.screenshot({path:`test-artifacts/love-letter-${name}.png`,fullPage:true});await touch.close();
 }
 if(process.env.STANDALONE_URL){const p=await browser.newPage();await p.goto(process.env.STANDALONE_URL,{waitUntil:'networkidle'});assert.equal(await p.locator('h1').innerText(),'Love Letter');await p.close();}
 assert.deepEqual(errors,[]);console.log('Love Letter browser passed: physical setup/draw/play, private handoff, preview, pending reload/cancel, undo/redo, atomic import, real analysis pause/resume, digital confirm and touch layouts.');
}finally{await page.screenshot({path:'test-artifacts/love-letter-last.png',fullPage:true}).catch(()=>{});await browser.close();}
