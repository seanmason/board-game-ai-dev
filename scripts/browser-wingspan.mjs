import assert from "node:assert/strict";
import {mkdirSync} from "node:fs";
import {chromium} from "playwright";

const base=(process.env.BASE_URL??'http://127.0.0.1:8080').replace(/\/$/,'')+'/';
const wingspanURL=new URL('wingspan/',base).href;
mkdirSync('test-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
  ...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1190,height:880}});
// Observe the real browser-to-worker contract without replacing worker execution.
await page.addInitScript(()=>{
  window.wingspanWorkerStarts=[];
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
    postMessage(message,...args){
      if(message?.type==='start')window.wingspanWorkerStarts.push({
        method:message.method,horizon:message.horizon,leafEvaluator:message.leafEvaluator
      });
      return super.postMessage(message,...args);
    }
  };
});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",e=>{
  const url=e.location().url;
  if(e.type()==="error"&&!e.text().includes("favicon.ico")&&!url.endsWith('/favicon.ico'))
    errors.push(e.text()+(url?' ['+url+']':''));
});
const samples=async()=>Number((await page.locator(".stat .value").first().innerText()).replaceAll(",",""));
const awaitSamples=async(amount=0)=>page.waitForFunction(n=>{
  const el=document.querySelector(".stat .value");
  return el&&Number(el.textContent.replaceAll(",",""))>n;
},amount,{timeout:20000});

try {
  await page.goto(wingspanURL,{waitUntil:"networkidle"});
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
  await page.locator('button[data-action="confirm-setup"]').click();
  await page.getByRole('alert').filter({hasText:'Discard exactly one food per kept bird'}).waitFor();
  assert.match(await page.locator('.banner strong').first().innerText(),/Player 1/i,
    'Invalid setup must keep the same player in setup');
  assert.equal(await page.locator('input[data-action="keep-card"]').count(),5);
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
  const starts=await page.evaluate(()=>window.wingspanWorkerStarts);
  assert.ok(starts.length>0,'Analysis must start actual workers');
  for(const start of starts){
    assert.equal(start.horizon,4,'Browser analysis preserves the approved depth');
    assert.equal(start.leafEvaluator,'opening-plan','Browser analysis preserves the approved evaluator');
  }
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

  // A white second-bird power accepts a human-selected payment and egg source.
  const secondBird=await page.evaluate(async()=>{
    const {newGame,applyAction}=await import('./core.js');
    let s=newGame({seed:12});
    while(s.phase==='setup')s=applyAction(s,{type:'setup',keep:[],foodDiscard:[],bonusId:s.players[s.currentPlayer].bonusOffer[0]});
    for(const id of [68,105,107]){
      const pool=[s.deck,s.birdDiscard,s.tray].find(a=>a.includes(id));pool.splice(pool.indexOf(id),1);
    }
    s.players[0].habitats.forest=[{id:68,eggs:1,cached:[],tucked:[]}];
    s.players[0].habitats.grassland=[{id:105,eggs:2,cached:[],tucked:[]}];
    s.eggSupply-=3;s.players[0].hand=[107];
    s.players[0].food={seed:1,fruit:1,fish:2,rodent:0,invertebrate:0};
    s.phase='power';s.pending=[{owner:0,habitat:'forest',index:0,birdId:68,code:37,timing:'white',event:{}}];
    return s;
  });
  await page.locator('#import-file').setInputFiles({name:'second-bird.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'board-game-ai-wingspan',version:1,
      history:[{state:secondBird,label:'Second bird'}],index:0,seats:['human','human']}))});
  await page.locator('#advanced-action-editor > summary').click();
  await page.locator('#adv-food-seed').fill('0');
  await page.locator('#adv-food-fish').fill('2');
  await page.locator('[data-adv-egg][data-habitat="grassland"]').fill('1');
  await page.locator('button[data-action="advanced-commit"]').click();
  const paid=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('board-game-ai-wingspan-v1'));return d.history[d.index].state;
  });
  assert.equal(paid.players[0].food.seed,1);
  assert.equal(paid.players[0].food.fish,0);
  assert.equal(paid.players[0].habitats.forest[1].id,107);
  assert.equal(paid.players[0].habitats.forest[0].eggs,1);
  assert.equal(paid.players[0].habitats.grassland[0].eggs,1);

  // Invalid session positions cannot partially replace the current game.
  await page.locator('#import-file').setInputFiles({name:'invalid-session.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({format:'board-game-ai-wingspan',version:1,
      history:[{state:secondBird,label:'Must not replace live game'}],index:0.5}))});
  await page.getByRole('alert').filter({hasText:'Invalid session history position'}).waitFor();
  const stillPaid=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('board-game-ai-wingspan-v1'));return d.history[d.index].state;
  });
  assert.deepEqual(stillPaid,paid);

  // A new physical session supports observed cards without inventing IDs.
  await page.locator("#mode").selectOption("physical");
  await page.locator('button[data-action="new-game"]').click();
  assert.match(await page.locator('#analysis-status').innerText(),/Needs observations/i,
    'Unknown physical setup must block speculative analysis');
  assert.ok(await page.getByText("Record the real table", {exact:false}).count());
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
  await page.screenshot({path:'test-artifacts/wingspan-desktop.png',fullPage:true});

  // Enter public setup through the UI, keeping starting private cards unknown.
  const physical=reread;
  for(let i=0;i<3;i++)await page.locator('#actual-tray-'+i).selectOption(String(physical.tray[i]));
  await page.locator('button[data-action="observe-tray"]').click();
  for(let i=0;i<5;i++)await page.locator('#observed-die-'+i).selectOption('seed');
  await page.locator('button[data-action="observe-feeder"]').click();
  for(let i=0;i<4;i++)await page.locator('#actual-goal-'+i).selectOption(i+':0');
  await page.locator('button[data-action="observe-goals"]').click();
  await page.locator('button[data-action="confirm-setup"]').click();
  await page.locator('button[data-action="confirm-setup"]').click();
  assert.match(await page.locator('#analysis-status').innerText(),/Needs observations/i);
  await page.getByRole('button',{name:'Draw 1 hidden bird',exact:true}).click();
  assert.equal(await page.locator('#physical-prompt').count(),1);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#physical-prompt').count(),1,'Pending draw survives reload');
  await page.locator('#actual-card').selectOption('unknown');
  await page.locator('button[data-action="answer-observation"]').click();
  const completed=await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('board-game-ai-wingspan-v1'));
    return d.history[d.index].state;
  });
  assert.equal(completed.turn,1);
  assert.equal(completed.players[0].hand.length,1);
  assert.ok(!completed.physical.knownBirds.includes(completed.players[0].hand[0]));
  await page.locator('button[data-action="undo"]').click();
  assert.equal(await page.locator('#physical-prompt').count(),1);
  await page.locator('button[data-action="redo"]').click();
  assert.equal(await page.locator('#physical-prompt').count(),0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+4),
    'Physical tracking should fit a phone');
  await page.screenshot({path:'test-artifacts/wingspan-physical-phone.png',fullPage:true});

  const tablet=await browser.newPage({
    viewport:{width:820,height:1110},deviceScaleFactor:2,hasTouch:true,isMobile:true
  });
  tablet.on("pageerror",e=>errors.push("tablet: "+e.message));
  await tablet.goto(wingspanURL,{waitUntil:"networkidle"});
  const measure=await tablet.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,width:window.innerWidth
  }));
  assert.ok(measure.scroll<=measure.width+4,"iPad should not scroll sideways");
  await tablet.screenshot({path:'test-artifacts/wingspan-tablet.png',fullPage:true});
  await tablet.close();

  const phone=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true
  });
  phone.on('pageerror',e=>errors.push('phone: '+e.message));
  await phone.goto(wingspanURL,{waitUntil:'networkidle'});
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4),
    'Starting choices should fit a touch phone');
  await phone.locator('input[data-action="keep-card"]').first().tap();
  await phone.locator('input[data-action="discard-food"]').first().tap();
  await phone.locator('button[data-action="confirm-setup"]').tap();
  assert.match(await phone.locator('.banner strong').first().innerText(),/Player 2/i);
  await phone.locator('button[data-action="confirm-setup"]').tap();
  await phone.locator('.action-group').filter({hasText:'Food'}).locator(
    'button[data-action="choose-option"]').first().tap();
  const phoneTurn=await phone.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('board-game-ai-wingspan-v1'));
    return d.history[d.index].state;
  });
  assert.equal(phoneTurn.remaining[0],7,'Touch action records exactly one turn');
  assert.equal(phoneTurn.currentPlayer,1);
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4),
    'Action controls should fit a touch phone');
  await phone.screenshot({path:'test-artifacts/wingspan-phone.png',fullPage:true});
  await phone.close();
  assert.equal(errors.length,0,"Browser errors: "+errors.join("; "));
  console.log("Wingspan browser smoke passed: setup, actions, food, undo/redo, "+
    "Monte Carlo workers, pause/resume, explicit AI, physical observation and iPad viewport.");
} finally {await browser.close();}
