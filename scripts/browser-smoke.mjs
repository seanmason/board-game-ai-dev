import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser = await chromium.launch({headless:true, args:["--no-sandbox"]});
const errors = [];
const page = await browser.newPage({viewport:{width:1120,height:900}});
page.on("pageerror", error=>errors.push(error.message));
page.on("console", message=>{if(message.type()==="error")errors.push(message.text());});
const simulations = async () => Number(
  (await page.locator(".stat .value").first().innerText()).replaceAll(",",""));
try {
  await page.goto("http://127.0.0.1:8080/", {waitUntil:"networkidle"});
  assert.match(await page.locator("h1").innerText(), /Azul/);
  assert.equal(await page.locator("#search-variant").inputValue(), "guided-informed");
  assert.equal(await page.locator("footer").count(),0,"Do not show promotional footer");
  assert.equal(await page.getByText("Tabletop Observatory").count(),0);
  assert.equal(await page.locator('button[data-action="set-slot"]').count(), 20);

  // Real factory observations must be entered explicitly.
  const slots = page.locator('button[data-action="set-slot"]');
  for(let i=0; i<20; i++) await slots.nth(i).click();
  await page.locator('button[data-action="confirm-factories"]').click();
  await page.waitForSelector('button[data-action="select-source"]');
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  const before = await page.locator(".banner").innerText();
  await page.waitForTimeout(1700);
  assert.equal(await page.locator(".banner").innerText(), before,
    "Analysis must never advance a physical game");

  // Search must publish real playouts, then pause without losing statistics.
  await page.waitForFunction(() => {
    const el=document.querySelector(".stat .value");
    return el && Number(el.textContent.replaceAll(",",""))>0;
  }, null, {timeout:15000});
  assert.match(await page.locator("#search-coverage").innerText(),
    /Explored \d+ of \d+ legal moves/);
  const beforePause = await simulations();
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForTimeout(600);
  assert.match(await page.locator("#search-state").innerText(), /paused/i);
  const paused = await simulations();
  assert.ok(paused >= beforePause, "Pause must preserve prior simulation count");
  await page.waitForTimeout(750);
  assert.equal(await simulations(), paused,
    "No further simulations may run after pause acknowledgement");

  // Mouseover must highlight source, color, and destination without playing.
  const firstCandidate = page.locator('tr[data-candidate-key]').first();
  assert.ok(await firstCandidate.count(), "Analysis should show candidate moves");
  await firstCandidate.hover();
  assert.equal(await page.locator(".ai-hover-source").count(), 1);
  assert.equal(await page.locator(".ai-hover-color").count(), 1);
  assert.equal(await page.locator(".ai-hover-destination").count(), 1);
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  await page.locator("h1").hover();
  assert.equal(await page.locator(".ai-hover-source").count(), 0);
  assert.equal(await page.locator(".ai-hover-destination").count(), 0);

  // Resume the SAME search and confirm visits continue beyond prior totals.
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForFunction(previous => {
    const el = document.querySelector(".stat .value");
    return el && Number(el.textContent.replaceAll(",","")) > previous;
  }, paused, {timeout:15000});
  assert.ok(await simulations() > paused, "Resume must accumulate prior playouts");
  // Changing MCTS policy intentionally invalidates the current search tree.
  await page.locator("#search-variant").selectOption("baseline");
  assert.equal(await page.locator("#search-variant").inputValue(), "baseline");
  await page.waitForFunction(() => {
    const count=document.querySelector(".stat .value");
    return count && Number(count.textContent.replaceAll(",",""))>0;
  }, null, {timeout:15000});
  await page.locator("#search-variant").selectOption("guided-informed");
  assert.equal(await page.locator("#search-variant").inputValue(), "guided-informed");
  await page.waitForFunction(() => {
    const count=document.querySelector(".stat .value");
    return count && Number(count.textContent.replaceAll(",",""))>0;
  }, null, {timeout:15000});

  // Physical game remains editable, including undo/redo.
  await page.locator('button[data-action="select-source"][data-source="0"][data-color="0"]').click();
  const row=page.locator('button[data-action="place-row"][data-row="0"]:not([disabled])');
  assert.equal(await row.count(),1);
  await row.click();
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/);
  await page.locator('button[data-action="undo"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  await page.locator('button[data-action="redo"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/);

  // Digital AI must NEVER act on a timer. Only explicit Play Best Move acts.
  await page.locator("#mode").selectOption("digital");
  await page.locator('button[data-action="new-game"]').click();
  await page.locator('select[data-action="seat-type"][data-seat="0"]').selectOption("ai");
  await page.locator('select[data-action="seat-type"][data-seat="1"]').selectOption("ai");
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  await page.waitForTimeout(2500);
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/,
    "AI must not play after the old 1.65 second timer");

  const playBest = page.locator('button[data-action="move-now"]');
  await playBest.waitFor();
  await page.waitForFunction(() => {
    const el=document.querySelector('button[data-action="move-now"]');
    return el && !el.disabled;
  }, null, {timeout:15000});
  const analyzed = await simulations();
  assert.ok(analyzed > 0, "Play Best Move must have a searched candidate");
  // Paused results remain playable and no new simulations are necessary.
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForTimeout(450);
  assert.ok(await simulations() >= analyzed);
  await playBest.click();
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/);
  await page.waitForTimeout(2000);
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/,
    "Second AI seat must also wait for an explicit command");
  // New sessions can begin with a selected first player (not always seat one).
  await page.locator("#players").selectOption("4");
  await page.locator("#starter").selectOption("3");
  await page.locator('button[data-action="new-game"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 4 to draft/);
  assert.equal(await page.locator(".player-board").count(),4);

  // Factory colors from an observed refill are unordered. In this synthetic
  // late-game inventory, the two old-bag tiles MUST be drawn before recycling,
  // but the observer enters recycled colors first on the screen.
  const recordedState=await page.evaluate(async()=>{
    const {newGame}=await import("./src/azul.js");
    const state=newGame({players:2,mode:"physical"});
    state.round=4;
    state.bag=[1,1,0,0,0];
    state.discard=[19,19,20,20,20];
    return state;
  });
  await page.locator("#import-file").setInputFiles({
    name:"recycled-factories.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({
      format:"tabletop-observatory-game",version:1,
      history:[{state:recordedState,label:"Synthetic late refill"}],
      index:0,seatTypes:["human","human"]
    }))
  });
  await page.waitForSelector('button[data-action="set-slot"]');
  const observed=[[2,2,2,2],[3,3,3,3],[4,4,4,4],[0,1,2,3],[0,1,4,3]];
  for(let factory=0;factory<observed.length;factory++){
    for(let slot=0;slot<observed[factory].length;slot++){
      await page.locator('button[data-action="palette"][data-color="' +
        observed[factory][slot] + '"]').click();
      await page.locator('button[data-action="set-slot"][data-factory="' +
        factory + '"][data-slot="' + slot + '"]').click();
    }
  }
  await page.locator('button[data-action="confirm-factories"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  const reconciledBag=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem("tabletop-observatory-azul-v1"));
    return data.history[data.index].state.bag;
  });
  assert.deepEqual(reconciledBag,[18,18,15,14,15],
    "Physical refill must not depend on observed color entry order");

  assert.equal(errors.length, 0, "Browser errors: " + errors.join("; "));
  console.log("Browser smoke passed: physical game, hover preview, cumulative pause/resume, manual digital AI moves.");
} finally {
  await browser.close();
}
