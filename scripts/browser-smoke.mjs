import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser = await chromium.launch({headless:true, args:["--no-sandbox"]});
const errors = [];
const page = await browser.newPage({viewport:{width:1120,height:900}});
page.on("pageerror", error=>errors.push(error.message));
page.on("console", message=>{if(message.type()==="error")errors.push(message.text());});
try {
  await page.goto("http://127.0.0.1:8080/", {waitUntil:"networkidle"});
  assert.match(await page.locator("h1").innerText(), /Azul/);
  assert.equal(await page.locator('button[data-action="set-slot"]').count(), 20);
  // Physical tracking: observed factory tiles must be entered explicitly.
  const slots=page.locator('button[data-action="set-slot"]');
  for (let i=0; i<20; i++) await slots.nth(i).click();
  await page.locator('button[data-action="confirm-factories"]').click();
  await page.waitForSelector('button[data-action="select-source"]');
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  const before=await page.locator(".banner").innerText();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator(".banner").innerText(), before,
    "AI analysis must never automatically advance a physical game");
  // Web Worker should publish at least one complete simulation.
  await page.waitForFunction(() => {
    const el=document.querySelector(".stat .value");
    return el && Number(el.textContent.replaceAll(",",""))>0;
  }, null, {timeout:15000});
  await page.locator('button[data-action="select-source"][data-source="0"][data-color="0"]').click();
  const row=page.locator('button[data-action="place-row"][data-row="0"]:not([disabled])');
  assert.equal(await row.count(),1);
  await row.click();
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/);
  await page.locator('button[data-action="undo"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 1 to draft/);
  await page.locator('button[data-action="redo"]').click();
  assert.match(await page.locator(".banner").innerText(), /Player 2 to draft/);
  // Digital mode: an independently assigned AI seat advances autonomously.
  await page.locator("#mode").selectOption("digital");
  await page.locator('button[data-action="new-game"]').click();
  await page.locator('select[data-action="seat-type"][data-seat="0"]').selectOption("ai");
  await page.waitForFunction(() => document.querySelector(".banner")?.textContent.includes("Player 2 to draft"),
    null, {timeout:16000});
  assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
  console.log("Browser smoke passed: physical observations, MCTS, manual moves, undo/redo, digital AI.");
} finally {
  await browser.close();
}
