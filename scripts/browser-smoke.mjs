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
  const beforePause = await simulations();
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForTimeout(600);
  assert.match(await page.locator("#search-state").innerText(), /Paused/);
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
  assert.equal(errors.length, 0, "Browser errors: " + errors.join("; "));
  console.log("Browser smoke passed: physical game, hover preview, cumulative pause/resume, manual digital AI moves.");
} finally {
  await browser.close();
}
