import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for(const {path,key,format,status} of [
    {path:'/azul.html',key:'tabletop-observatory-azul-v1',format:'tabletop-observatory-game',status:'.banner'},
    {path:'/pentago/',key:'board-game-ai-pentago-v1',format:'board-game-ai-pentago',status:'#turn-status'}
  ]) {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8080'+path);
    await page.locator('[data-action="new-game"]').click();
    const before=await page.evaluate(key=>localStorage.getItem(key),key);
    const data=JSON.parse(before);data.format=format;data.index=.5;
    await page.locator('#import-file').setInputFiles({name:'bad-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(),/history position/);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before);
    // A failed import must not poison the next manual action or valid import.
    data.index=0;
    await page.locator('#import-file').setInputFiles({name:'valid-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await page.waitForFunction(()=>!document.querySelector('[role="alert"]'));
    assert.ok(await page.locator(status).count());
    await page.reload();assert.ok(await page.locator('h1').count());
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('Session browser regression passed for Azul and Pentago');
} finally {await browser.close();}
