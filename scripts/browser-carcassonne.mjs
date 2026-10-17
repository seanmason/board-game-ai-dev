import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.BASE_URL??'http://127.0.0.1:8080',browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('board-game-ai-carcassonne-v1'));return d.history[d.index].state;});
try{
 await page.goto(base+'/carcassonne/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('h1').innerText(),'Carcassonne');
 assert.equal(await page.locator('#samples').count(),0);
 await page.locator('[data-action=choose][data-id=E]').click();await page.locator('[data-action=draw]').click();
 assert.equal((await state()).drawn,'E');assert.equal((await state()).phase,'place');
 await page.waitForFunction(()=>Number(document.querySelector('#samples')?.textContent)>0);
 assert.equal((await state()).turn,0,'No autoplay');
 await page.locator('[data-action=pause]').click();await page.waitForTimeout(350);const samples=Number(await page.locator('#samples').innerText());await page.waitForTimeout(500);assert.equal(Number(await page.locator('#samples').innerText()),samples);
 await page.locator('[data-action=pause]').click();await page.waitForFunction(n=>Number(document.querySelector('#samples')?.textContent)>n,samples);
 await page.locator('[data-action=rotate]').click();await page.locator('[data-action=rotate]').click();
 await page.locator('.cell[data-x="0"][data-y="-1"]').click();assert.equal((await state()).phase,'meeple');
 await page.locator('[data-action=meeple][data-feature="0"]').click();assert.equal((await state()).players[0].score,4);assert.equal((await state()).phase,'draw');
 await page.locator('[data-action=undo]').click();assert.equal((await state()).phase,'meeple');await page.locator('[data-action=redo]').click();assert.equal((await state()).players[0].score,4);
 await page.reload({waitUntil:'networkidle'});assert.equal((await state()).players[0].score,4);
 const before=await state();await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'board-game-ai-carcassonne',version:1,history:[{state:before,label:'Position'}],index:.5}))});await page.getByRole('alert').filter({hasText:'Invalid session history position'}).waitFor();assert.deepEqual(await state(),before);
 await page.locator('[data-action=choose][data-id=C]').click();await page.locator('[data-action=draw]').click();assert.equal((await state()).phase,'draw');assert.deepEqual((await state()).discarded,['C']);
 await page.locator('#mode').selectOption('digital');await page.locator('[data-action=new]').click();await page.waitForFunction(()=>Number(document.querySelector('#samples')?.textContent)>0);assert.equal((await state()).turn,0);await page.locator('[data-action=suggestion]').first().click();assert.equal((await state()).turn,1);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3));
 await page.screenshot({path:'/tmp/carcassonne-phone.png',fullPage:true});
 const vb=await page.locator('#board').getAttribute('viewBox');await page.locator('[data-action=in]').click();assert.notEqual(await page.locator('#board').getAttribute('viewBox'),vb);
 if(process.env.STANDALONE_URL){const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.STANDALONE_URL,{waitUntil:'networkidle'});await p.locator('#mode').selectOption('digital');await p.locator('[data-action=new]').click();await p.waitForFunction(()=>Number(document.querySelector('#samples')?.textContent)>0);await p.close();}
 assert.deepEqual(errors,[]);console.log('Carcassonne browser passed: actual draw, placement, meeple scoring, no autoplay, discard/redraw, worker pause/resume, undo/redo, persistence, atomic import, zoom and phone layout.');
}finally{await page.screenshot({path:'/tmp/carcassonne-last.png',fullPage:true}).catch(()=>{});await browser.close();}
