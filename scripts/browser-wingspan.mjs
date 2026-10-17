import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:1190,height:880}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",e=>{
  if(e.type()==="error"&&!e.text().includes("favicon.ico"))errors.push(e.text());
});
const samples=async()=>Number((await page.locator(".stat .value").first().innerText()).replaceAll(",",""));
const awaitSamples=async(amount=0)=>page.waitForFunction(n=>{
  const el=document.querySelector(".stat .value");
  return el&&Number(el.textContent.replaceAll(",",""))>n;
},amount,{timeout:20000});

try {
  await page.goto("http://127.0.0.1:8080/wingspan/",{waitUntil:"networkidle"});
  assert.match(await page.locator("h1").innerText(),/Wingspan/);
  assert.equal(await page.locator(".tray .bird").count(),3);
  assert.equal(await page.locator(".die").count(),5);
  assert.equal(await page.locator(".score-card").count(),6);
  assert.equal(await page.locator('input[data-action="keep-card"]').count(),5);
  assert.equal(await page.locator('input[data-action="bonus"]').count(),2);
  assert.equal(await page.locator('input[data-action="discard-food"]').count(),5);
  assert.equal(await page.locator("details").last().evaluate(el=>el.open),false,
    "Rules must remain collapsed by default");

  // Explicit human setup with food-for-bird exchange and one bonus choice.
  await page.locator('input[data-action="keep-card"]').first().check();
  await page.locator('input[data-action="discard-food"]').first().check();
  await page.locator('button[data-action="confirm-setup"]').click();
  assert.match(await page.locator(".banner strong").first().innerText(),/Player 2/i);
  await page.locator('button[data-action="confirm-setup"]').click();
  assert.match(await page.locator(".banner strong").first().innerText(),/Round 1/i);
  assert.equal(await page.locator(".columns .habitat").count(),3);
  assert.equal(await page.locator(".action-group").count(),4);

  // A representative food action makes exactly one recorded main turn.
  const previous=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return s.history[s.index].state;
  });
  await page.locator(".action-group").filter({hasText:"Food"}).locator(
    'button[data-action="choose-option"]').first().click();
  const after=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return s.history[s.index].state;
  });
  assert.equal(after.players[0].food[after.lastEvent.foods[0]],
    previous.players[0].food[after.lastEvent.foods[0]]+1);
  assert.equal(after.remaining[0],7);
  assert.equal(after.currentPlayer,1);
  await page.locator('button[data-action="undo"]').click();
  assert.match(await page.locator(".banner strong").first().innerText(),/Player 1/i);
  await page.locator('button[data-action="redo"]').click();
  assert.equal(await page.locator(".action-group").count(),4);

  // Detailed human action input must support non-AI allocation decisions.
  await page.locator("#advanced-action-editor > summary").click();
  assert.ok(await page.locator("#adv-kind").count());
  await page.locator("#adv-kind").selectOption("layEggs");
  assert.equal(await page.locator("#advanced-action-editor").evaluate(el=>el.open),
    true,"Changing detailed action type keeps the editor open");
  await page.locator('button[data-action="advanced-commit"]').click();
  const afterDetailed=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state;
  });
  assert.equal(afterDetailed.remaining[1],7,
    "Detailed action consumes exactly one player action cube");
  await page.locator('button[data-action="undo"]').click();

  // Both analysis methods must be independently usable in the browser.
  await awaitSamples();
  assert.equal(await page.locator("#search-method").inputValue(),"belief-rollout");
  const unchanged=await page.locator(".banner strong").first().innerText();
  await page.locator("#search-method").selectOption("heuristic");
  assert.equal(await page.locator("#search-method").inputValue(),"heuristic");
  await awaitSamples();
  await page.locator("#search-method").selectOption("belief-rollout");
  await awaitSamples();
  assert.equal(await page.locator(".banner strong").first().innerText(),unchanged,
    "Rollout analysis must not play moves automatically");
  const beforePause=await samples();
  await page.locator('button[data-action="toggle-analysis"]').click();
  await page.waitForTimeout(550);
  const stopped=await samples();
  assert.ok(stopped>=beforePause);
  await page.waitForTimeout(650);
  assert.equal(await samples(),stopped,"Paused simulations should be preserved");
  await page.locator('button[data-action="toggle-analysis"]').click();
  await awaitSamples(stopped);
  const turnText=await page.locator(".banner strong").first().innerText();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".banner strong").first().innerText(),turnText,
    "AI must never move automatically");

  await page.locator('select[data-action="seat"][data-player="1"]').selectOption("ai");
  await page.waitForFunction(()=>{
    const b=document.querySelector('button[data-action="play-best"]');
    return b&&!b.disabled;
  },null,{timeout:12000});
  await page.locator('button[data-action="play-best"]').click();
  const once=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state;
  });
  assert.equal(once.remaining[1],7,"Play Best Move should spend exactly one action");

  // Detailed bird-play editor: explicitly pay food instead of accepting
  // the quick-action generator's preferred payment allocation.
  const detailedFixture=await page.evaluate(async()=>{
    const {newGame,applyAction,assertValid}=await import("./core.js");
    const {BIRDS}=await import("./catalog.js");
    let s=newGame({players:2,seed:31237,mode:"digital"});
    while(s.phase==="setup"){
      const p=s.players[s.currentPlayer];
      s=applyAction(s,{type:"setup",keep:[],foodDiscard:[],
        bonusId:p.bonusOffer[0]});
    }
    const birdId=s.deck.find(id=>BIRDS[id].habitats.includes("forest")&&
      BIRDS[id].powerType!=="white");
    if(birdId===undefined)throw Error("No affordable forest fixture bird");
    s.deck.splice(s.deck.indexOf(birdId),1);
    s.players[0].hand.push(birdId);
    for(const k of ["invertebrate","seed","fish","fruit","rodent"])
      s.players[0].food[k]=8;
    assertValid(s);
    return {state:s,birdId};
  });
  await page.locator("#import-file").setInputFiles({
    name:"wingspan-detailed-bird.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify({
      format:"board-game-ai-wingspan",version:1,
      history:[{state:detailedFixture.state,label:"Detailed bird fixture"}],
      index:0,seats:["human","human"]
    }))
  });
  await page.locator("#advanced-action-editor > summary").click();
  await page.locator("#adv-kind").selectOption("playBird");
  await page.locator('button[data-action="advanced-commit"]').click();
  const afterBird=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state;
  });
  assert.equal(afterBird.players[0].habitats.forest[0].id,detailedFixture.birdId);
  assert.equal(afterBird.remaining[0],7,
    "Custom food payment for a forest bird should complete one turn");

  // A new physical session supports observed cards without inventing IDs.
  await page.locator("#mode").selectOption("physical");
  await page.locator('button[data-action="new-game"]').click();
  assert.ok(await page.getByText("Physical tracking is provisional", {exact:false}).count());
  assert.equal(await page.locator('button[data-action="record-best"]').count(),0,
    "Speculative physical suggestions must not be directly committed");
  const wanted=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state.deck.at(-1);
  });
  // Observation corrections are intentionally in a collapsed advanced panel.
  await page.getByText("Record physical observations and corrections").click();
  await page.locator("#obs-card").selectOption(String(wanted));
  await page.locator('button[data-action="observe-card"]').click();
  const tracked=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state;
  });
  assert.equal(tracked.players[0].hand[0],wanted);
  await page.reload({waitUntil:"networkidle"});
  const reread=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem("board-game-ai-wingspan-v1"));
    return d.history[d.index].state;
  });
  assert.equal(reread.players[0].hand[0],wanted,"Physical observations should persist");
  assert.equal(reread.mode,"physical");

  const tablet=await browser.newPage({
    viewport:{width:820,height:1110},deviceScaleFactor:2,hasTouch:true,isMobile:true
  });
  tablet.on("pageerror",e=>errors.push("tablet: "+e.message));
  await tablet.goto("http://127.0.0.1:8080/wingspan/",{waitUntil:"networkidle"});
  const measure=await tablet.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,width:window.innerWidth
  }));
  assert.ok(measure.scroll<=measure.width+4,"iPad should not scroll sideways");
  await tablet.close();
  assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
  console.log("Wingspan browser smoke passed: setup, actions, food, undo/redo, "+
    "Monte Carlo workers, pause/resume, explicit AI, physical observation and iPad viewport.");
} finally {await browser.close();}
