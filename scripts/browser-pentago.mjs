import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1120,height:850}});
const errors=[];
page.on("pageerror",err=>errors.push(err.message));
page.on("console",event=>{if(event.type()==="error")errors.push(event.text());});
const getSims=async()=>Number(
  (await page.locator(".stat .value").first().innerText()).replaceAll(",",""));
const waitSims=async(min=0)=>page.waitForFunction(min=>{
  const el=document.querySelector(".stat .value");
  return el&&Number(el.textContent.replaceAll(",",""))>min;
},min,{timeout:30000});
try{
  await page.goto("http://127.0.0.1:8080/pentago/",{waitUntil:"networkidle"});
  assert.match(await page.locator("h1").innerText(),/Pentago/);
  assert.equal(await page.locator('button[data-action="cell"]').count(),36);
  assert.equal(await page.locator(".quadrant").count(),4);
  assert.equal(await page.locator(".rules details").count(),1);
  assert.equal(await page.locator(".rules details").evaluate(el=>el.open),false,
    "Rules should be collapsed by default");
  assert.equal(await page.locator('a[href="../"]').count(),1,"Link to other game");

  // Normal physical move requires both a placement and a 90° quadrant twist.
  await page.locator('button[data-action="cell"][data-cell="0"]').click();
  assert.match(await page.locator("#move-instruction").innerText(),/Placing at A1/);
  assert.equal(await page.locator(".marble.ghost").count(),1);
  assert.equal(await page.locator('button[data-action="rotate"]:not([disabled])').count(),8);
  await page.locator('button[data-action="rotate"][data-quadrant="0"][data-direction="1"]').click();
  assert.match(await page.locator("#turn-status").innerText(),/White to play/);
  assert.equal(await page.locator(".marble.black").count(),1);
  assert.equal(await page.locator(".marble.ghost").count(),0);
  await page.locator('button[data-action="undo"]').click();
  assert.equal(await page.locator(".marble.black").count(),0);
  await page.locator('button[data-action="redo"]').click();
  assert.equal(await page.locator(".marble.black").count(),1);

  // A neutral quadrant makes rotation optional, including the opening.
  await page.locator('button[data-action="new-game"]').click();
  await page.locator('button[data-action="cell"][data-cell="7"]').click();
  assert.ok(await page.locator('button[data-action="skip-twist"]').count());
  await page.locator('button[data-action="skip-twist"]').click();
  assert.match(await page.locator("#turn-status").innerText(),/White to play/);

  // Search continues without committing any suggested action.
  await waitSims();
  assert.equal(await page.locator("#move-policy").inputValue(),"heuristic");
  assert.match(await page.locator(".recommendation .eyebrow").innerText(),
    /Heuristic recommendation/i);
  const beforePolicy=await getSims();
  await page.locator("#move-policy").selectOption("mcts");
  assert.match(await page.locator(".recommendation .eyebrow").innerText(),
    /MCTS most-visited move/i);
  assert.ok(await getSims()>=beforePolicy,
    "Changing recommendation policy must preserve MCTS simulations");
  await page.locator("#move-policy").selectOption("heuristic");
  assert.equal(await page.locator("#move-policy").inputValue(),"heuristic");
  const status=await page.locator("#turn-status").innerText();
  await page.waitForTimeout(1700);
  assert.equal(await page.locator("#turn-status").innerText(),status);
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForTimeout(800);
  assert.match(await page.locator("#analysis-status").innerText(),/Paused/i);
  const paused=await getSims();
  await page.waitForTimeout(600);
  assert.equal(await getSims(),paused,"Paused searches must not advance");
  await page.locator('button[data-action="toggle-search"]').click();
  await waitSims(paused);
  assert.ok(await getSims()>paused);

  // Candidate inspection is reversible and highlights both sub-decisions.
  const top=page.locator("tr[data-candidate-key]").first();
  assert.ok(await top.count());
  await top.hover();
  assert.equal(await page.locator(".hover-cell").count(),1);
  await page.locator("h1").hover();
  assert.equal(await page.locator(".hover-cell").count(),0);
  await top.locator('button[data-action="candidate"]').click();
  assert.equal(await page.locator(".hover-cell").count(),1);
  await page.locator('button[data-action="toggle-search"]').click();
  await page.waitForTimeout(650);
  const visitsBefore=await getSims();
  await page.locator('button[data-action="record-best"]').click();
  assert.match(await page.locator("#turn-status").innerText(),/Black to play/);
  const nowRetained=await getSims();
  assert.ok(nowRetained<=visitsBefore,"Only visited child statistics can survive reroot");
  assert.match(await page.locator("#analysis-status").innerText(),/Paused/i);

  // Digital AI seats never autoplay; the user explicitly triggers a full move.
  await page.locator("#mode").selectOption("digital");
  await page.locator('button[data-action="new-game"]').click();
  await page.locator('select[data-action="seat"][data-seat="0"]').selectOption("ai");
  await page.waitForTimeout(1750);
  assert.match(await page.locator("#turn-status").innerText(),/Black to play/);
  await page.locator('button[data-action="toggle-search"]').click();
  await waitSims();
  await page.waitForFunction(()=>!document.querySelector(
    'button[data-action="play-best"]')?.disabled,{timeout:30000});
  await page.locator('button[data-action="play-best"]').click();
  assert.match(await page.locator("#turn-status").innerText(),/White to play/);
  const newGameData=await page.evaluate(()=>{
    const value=JSON.parse(localStorage.getItem("board-game-ai-pentago-v1"));
    return value.history[value.index].state;
  });
  assert.equal(newGameData.ply,1,"AI makes precisely one full turn");

  // Refresh maintains the session, while the in-memory analysis restarts.
  await page.reload({waitUntil:"networkidle"});
  assert.match(await page.locator("#turn-status").innerText(),/White to play/);
  assert.equal(await page.locator(".marble.black").count(),1);
  // Touch layouts: iPad companion and narrow mobile viewports must remain
  // usable without a mouse or a sideways-scrolling board.
  const tablet=await browser.newPage({
    viewport:{width:768,height:1024},deviceScaleFactor:2,hasTouch:true,isMobile:true
  });
  tablet.on("pageerror",e=>errors.push("tablet: "+e.message));
  await tablet.goto("http://127.0.0.1:8080/pentago/",{waitUntil:"networkidle"});
  await tablet.locator('button[data-action="cell"][data-cell="7"]').tap();
  assert.equal(await tablet.locator(".marble.ghost").count(),1);
  await tablet.locator('button[data-action="skip-twist"]').tap();
  assert.match(await tablet.locator("#turn-status").innerText(),/White to play/);
  const tabletLayout=await tablet.evaluate(()=>
    ({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
  assert.ok(tabletLayout.scroll<=tabletLayout.width+2,
    "iPad viewport must not scroll horizontally");
  await tablet.close();

  const phone=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true
  });
  phone.on("pageerror",e=>errors.push("phone: "+e.message));
  await phone.goto("http://127.0.0.1:8080/pentago/",{waitUntil:"networkidle"});
  const phoneLayout=await phone.evaluate(()=>
    ({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
  assert.ok(phoneLayout.scroll<=phoneLayout.width+2,
    "Narrow viewport must not scroll horizontally");
  assert.equal(await phone.locator(".quadrant").count(),4);
  await phone.close();

  assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
  console.log("Pentago browser smoke passed: physical place/twist, neutral skip, pause/resume, "+
    "hover, reroot, manual AI, undo/redo and reload.");
}finally{
  await browser.close();
}
