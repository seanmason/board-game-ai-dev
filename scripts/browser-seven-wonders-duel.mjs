import assert from 'node:assert/strict';import {chromium} from 'playwright';
const base=process.env.SEVEN_WONDERS_DUEL_BASE_URL??'http://127.0.0.1:8080/seven-wonders-duel/';
const standalone=process.env.SEVEN_WONDERS_DUEL_STANDALONE_URL??'http://127.0.0.1:8080/standalone-seven-wonders-duel/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1360,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon'))errors.push(e.text());});
const state=()=>page.evaluate(()=>window.duel.getState());
try{
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.clear());await page.reload();
 assert.match(await page.locator('h1').innerText(),/7 Wonders/);assert.equal((await state()).phase,'progress-setup');
 for(const id of ['agriculture','architecture','economy','law','masonry'])await page.locator(`[name=component][value="${id}"]`).check();await page.getByRole('button',{name:'Confirm observed progress'}).click();
 for(let round=0;round<2;round++){for(const id of (round?['w5','w6','w7','w8']:['w1','w2','w3','w4']))await page.locator(`[name=component][value="${id}"]`).check();await page.getByRole('button',{name:'Confirm observed wonder-offer'}).click();for(let i=0;i<4;i++)await page.locator('#entry [data-action]').first().click();}
 assert.equal((await state()).phase,'reveal');assert.ok((await state()).board.filter(x=>!x.up).every(x=>x.id===null));
 while((await state()).phase==='reveal'){await page.locator('#next-card').click();await page.locator('#card-options [data-card]').first().click();}
 await page.waitForFunction(()=>window.duel.getIterations()>0);assert.equal((await state()).turn,0);assert.ok(!('secret' in await state()));
 const before=await state();await page.locator('[data-candidate]').first().click();assert.deepEqual(await state(),before,'Candidate pin never commits');
 await page.locator('#pause').click();await page.waitForTimeout(180);const samples=await page.evaluate(()=>window.duel.getIterations());await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>window.duel.getIterations()),samples);await page.locator('#pause').click();await page.waitForFunction(n=>window.duel.getIterations()>n,samples);
 await page.locator('#entry [data-action]').first().click();assert.equal((await state()).turn,1);
 await page.locator('#undo').click();assert.equal((await state()).turn,0);await page.locator('#redo').click();assert.equal((await state()).turn,1);
 await page.reload({waitUntil:'networkidle'});assert.equal((await state()).turn,1);await page.screenshot({path:'/tmp/seven-wonders-duel-desktop.png',fullPage:true});
 const saved=await state();await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'seven-wonders-duel',version:1,index:.5,history:[{label:'x',state:saved}]}))});await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('Invalid session history position'));assert.deepEqual(await state(),saved);
 const forged=structuredClone(saved);forged.board[0].index='x" onclick="alert(1)';await page.locator('#import').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'seven-wonders-duel',version:1,index:0,history:[{label:'<img src=x onerror=alert(1)>',state:forged}]}))});await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('Invalid 7 Wonders Duel state'));assert.deepEqual(await state(),saved);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Phone horizontal overflow');await page.screenshot({path:'/tmp/seven-wonders-duel-phone.png',fullPage:true});
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(standalone,{waitUntil:'networkidle'});await p.locator('#mode').selectOption('digital');await p.locator('#new').click();for(let i=0;i<8;i++)await p.locator('#entry [data-action]').first().click();await p.waitForFunction(()=>window.duel.getIterations()>0);assert.equal(await p.evaluate(()=>window.duel.getState().turn),0);await p.locator('[data-slot].available').first().click();await p.locator('#entry [data-action]').first().click();assert.equal(await p.evaluate(()=>window.duel.getState().turn),1);await p.close();
 assert.deepEqual(errors,[]);console.log('7 Wonders Duel browser passed: actual setup/draft/reveals, privacy, continuous analysis, pinning without moves, pause/resume, explicit recording, undo/redo/reload, atomic malicious import rejection, phone overflow and standalone module worker.');
}finally{await page.screenshot({path:'/tmp/seven-wonders-duel-last.png',fullPage:true}).catch(()=>{});await browser.close();}
