import assert from 'node:assert/strict';

/** Browser regressions for stale branch caches, API throttling and monotonic data. */
export async function verifyLiveDashboard(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 const sha='a'.repeat(40),oldTime='2000-01-01T00:00:00Z';let lookups=0,apiAvailable=true;
 const row={game:'wingspan',players:2,policyId:'Collection',scope:'Fixture only',budget:{},metricKind:'progress',planned:100,finished:1,
  counts:{complete:1,capped:0,unresolved:0,illegal:0,error:0},seedGroups:100,completeSeedGroups:1,winShare:{mean:null,low:null,high:null},margin:{mean:null,low:null,high:null},chance:.5};
 const old={schema:1,study:'wingspan-selfplay',status:'running',updatedAt:oldTime,finished:1,planned:100,workers:24,rows:[row]},fresh={...old,updatedAt:new Date().toISOString(),finished:50};
 const errors=[];
 await context.route('https://raw.githubusercontent.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().includes('/'+sha+'/')?fresh:old)}));
 await context.route('https://api.github.com/repos/seanmason/board-game-ai-dev/git/ref/heads/**',route=>{lookups++;return route.fulfill({status:apiAvailable?200:503,contentType:'application/json',body:JSON.stringify({object:{sha}})});});
 // Exercise live-cache behavior even after the real study is pinned complete.
 await context.route('**/benchmark-dashboard/app.js*',async route=>{
  const response=await route.fetch(),body=await response.text();
  const live='https://raw.githubusercontent.com/seanmason/board-game-ai-dev/benchmarks/wingspan-selfplay-2026-10-19/wingspan-selfplay/dashboard.json';
  const patched=body.replace(/https:\/\/raw\.githubusercontent\.com\/seanmason\/board-game-ai-dev\/[a-f0-9]{40}\/wingspan-selfplay\/dashboard\.json/,live);
  await route.fulfill({response,body:patched});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'benchmark-dashboard/?study=wingspan-selfplay',{waitUntil:'networkidle'});
  await page.getByText('50 / 100 games recorded',{exact:false}).waitFor();
  assert.equal(lookups,1);assert.match(await page.locator('#download').getAttribute('href'),new RegExp(sha));
  assert.doesNotMatch(await page.locator('#status').innerText(),/stale/);
  fresh.rows[0]={...row,metricKind:'loss',training:{selectedEpoch:1,dev:{mae:7}}};fresh.finished=60;fresh.updatedAt=new Date(Date.now()+1000).toISOString();
  await page.locator('#refresh').tap();await page.getByText('60 / 100 games recorded',{exact:false}).waitFor();assert.equal(lookups,1);assert.doesNotMatch(await page.locator('.card').innerText(),/Held-out learning check/);
  // Neither an older branch nor an older immutable response may roll back progress.
  fresh.finished=55;fresh.updatedAt=oldTime;
  await page.locator('#refresh').tap();await page.waitForTimeout(100);assert.match(await page.locator('#totals').innerText(),/60 \/ 100/);
  // A later rate-limit/outage keeps the newest known bytes, with an honest age.
  apiAvailable=false;await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+190000;});
  await page.locator('#refresh').tap();await page.waitForTimeout(100);
  assert.equal(lookups,2);assert.match(await page.locator('#totals').innerText(),/60 \/ 100/);
  assert.match(await page.locator('#status').innerText(),/stale/);assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  console.log('Live dashboard browser passed: immutable recovery, throttled reference lookup, monotonic snapshots and API outage retention.');
 }finally{await context.close();}
}
