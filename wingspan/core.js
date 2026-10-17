import {BIRDS,BONUSES,GOAL_TILES} from "./catalog.js";
import {FOOD,HABITATS,roundGoalScores,finalOutcome,totalEggs,scorePlayer} from "./scoring.js";
import {powerAvailable,powerOptions,applyPower} from "./powers.js";

const fail=message=>{throw Error(message);};
const check=(ok,message)=>{if(!ok)fail(message);};
const sum=a=>a.reduce((n,x)=>n+x,0);
export const initialFood=()=>Object.fromEntries(FOOD.map(f=>[f,1]));
export const emptyFood=()=>Object.fromEntries(FOOD.map(f=>[f,0]));
export const FEEDER_FACES=["invertebrate","seed","fish","fruit","rodent","dual"];
export const RESOURCE_PROGRESSION={
  forest:[1,1,2,2,3,3],
  grassland:[2,2,3,3,4,4],
  wetland:[1,1,2,2,3,3]
};
export const EGG_COLUMN_COST=[0,1,1,2,2];
export const ROUND_ACTIONS=[8,7,6,5];
export const colors=["#536f46","#bea66b","#7daab8"];
export const seededRandom=(seed=1)=>{
  let value=seed>>>0;
  return ()=>{
    value+=0x6D2B79F5;
    let x=value;
    x=Math.imul(x^(x>>>15),x|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return ((x^(x>>>14))>>>0)/4294967296;
  };
};
export function rng(s){
  s.rngState=(s.rngState+0x6D2B79F5)>>>0;
  let x=s.rngState;
  x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
}
function shuffled(s,items){
  const array=[...items];
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(rng(s)*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}
function drawFromDeck(s,who="bird"){
  const isBonus=who==="bonus";
  const deck=isBonus?"bonusDeck":"deck";
  const discard=isBonus?"bonusDiscard":"birdDiscard";
  if(!s[deck].length&&s[discard].length){
    s[deck]=shuffled(s,s[discard]);
    s[discard]=[];
  }
  return s[deck].length?s[deck].pop():null;
}
function drawBird(s,player){
  const card=drawFromDeck(s,"bird");
  if(card!==null && player!==null)s.players[player].hand.push(card);
  return card;
}
function drawBonus(s,player){
  const card=drawFromDeck(s,"bonus");
  if(card!==null&&player!==null)s.players[player].bonusOffer.push(card);
  return card;
}
function rollFeeder(s){
  s.feeder=Array.from({length:5},()=>FEEDER_FACES[Math.floor(rng(s)*6)]);
  return s.feeder;
}
export function newGame({
  players=2,starter=0,seed=1,goalMode="green",mode="digital",goals=null
}={}){
  check(Number.isInteger(players)&&players>=2&&players<=5,"Wingspan needs 2–5 players");
  check(Number.isInteger(starter)&&starter>=0&&starter<players,"Invalid starting player");
  check(["physical","digital"].includes(mode),"Invalid game mode");
  check(["green","blue"].includes(goalMode),"Invalid goal board");
  const playersData=Array.from({length:players},()=>({
    food:initialFood(),hand:[],bonusOffer:[],bonuses:[],
    habitats:Object.fromEntries(HABITATS.map(h=>[h,[]])),
    goalPoints:[],pinkUsed:[],setupDone:false
  }));
  const s={
    version:1,mode,goalMode,round:1,phase:"setup",starter,
    currentPlayer:starter,players:playersData,
    remaining:playersData.map(()=>8),turn:0,pending:[],turnContext:null,
    deck:[],birdDiscard:[],bonusDeck:[],bonusDiscard:[],
    tray:[],feeder:[],eggSupply:75,
    goals:[],lastEvent:null,rngState:seed>>>0
  };
  s.deck=shuffled(s,Array.from({length:BIRDS.length},(_,i)=>i));
  s.bonusDeck=shuffled(s,Array.from({length:BONUSES.length},(_,i)=>i));
  if(goals) {
    check(Array.isArray(goals)&&goals.length===4,"Choose four goal tiles");
    s.goals=goals.map(({tile,side})=>{
      check(Number.isInteger(tile)&&tile>=0&&tile<8 &&
        [0,1].includes(side),"Invalid goal tile");
      return {tile,side,face:GOAL_TILES[tile][side]};
    });
    check(new Set(goals.map(x=>x.tile)).size===4,"Do not reuse a physical goal tile");
  } else {
    const chosen=shuffled(s,Array.from({length:8},(_,i)=>i)).slice(0,4);
    s.goals=chosen.map(tile=>{
      const side=Math.floor(rng(s)*2);
      return {tile,side,face:GOAL_TILES[tile][side]};
    });
  }
  for(let p=0;p<players;p++){
    for(let i=0;i<5;i++)drawBird(s,p);
    for(let i=0;i<2;i++)drawBonus(s,p);
  }
  for(let i=0;i<3;i++){const bird=drawBird(s,null);if(bird!==null)s.tray.push(bird);}
  rollFeeder(s);
  return s;
}
export function cloneGame(s){return structuredClone(s);}
const validBirdEntry=e=>e&&Number.isInteger(e.id)&&e.id>=0&&
  e.id<BIRDS.length&&Number.isInteger(e.eggs)&&e.eggs>=0&&
  Array.isArray(e.cached)&&e.cached.every(f=>FOOD.includes(f))&&
  Array.isArray(e.tucked)&&e.tucked.every(x=>Number.isInteger(x)&&x>=0&&x<BIRDS.length);
const emptySlot=s=>s.players[s.currentPlayer];
function unitBird(id){
  return {id,eggs:0,cached:[],tucked:[]};
}
function addEggs(s,player,habitat,index,count=1){
  const bird=s.players[player].habitats[habitat]?.[index];
  if(!bird)return 0;
  const allowed=Math.min(Math.max(0,count),BIRDS[bird.id].eggs-bird.eggs,s.eggSupply);
  if(allowed>0){bird.eggs+=allowed;s.eggSupply-=allowed;}
  return allowed;
}
function removeEggs(s,player,sources,count){
  check(Array.isArray(sources),"Specify egg payment locations");
  let removed=0;
  for(const source of sources){
    check(HABITATS.includes(source.habitat)&&Number.isInteger(source.index)&&
      Number.isInteger(source.count)&&source.count>0,"Invalid egg source");
    const bird=s.players[player].habitats[source.habitat]?.[source.index];
    check(bird&&bird.eggs>=source.count,"Not enough eggs on selected bird");
    bird.eggs-=source.count;
    s.eggSupply+=source.count;
    removed+=source.count;
  }
  check(removed===count,"Egg payment must total "+count);
}
function useFood(s,player,payment){
  check(Array.isArray(payment)&&payment.every(x=>FOOD.includes(x)),
    "Food payment must list individual food types");
  const owned=s.players[player].food;
  const counts=Object.fromEntries(FOOD.map(f=>[f,0]));
  for(const type of payment) counts[type]++;
  for(const type of FOOD)check(counts[type]<=owned[type],"Not enough "+type);
  for(const type of payment)owned[type]--;
}
function satisfiesCost(card,payment){
  const cost=card.food;
  const required=card.either?
    [...FOOD,"wild"].filter(f=>cost[f]>0).map(type=>[type]):
    [...FOOD,"wild"].flatMap(f=>Array.from({length:cost[f]},()=>[f]));
  const alternatives=card.either?
    [[...FOOD,"wild"].filter(f=>cost[f]>0)
      .flatMap(type=>type==="wild"?FOOD:[type])] :
    required.map(([type])=>type==="wild"?[...FOOD]:[type]);
  function matches(index,remaining){
    if(index===alternatives.length)return remaining.every(c=>c===0);
    for(const type of alternatives[index]){
      const i=FOOD.indexOf(type);
      if(remaining[i]){
        remaining[i]--;
        if(matches(index+1,remaining))return true;
        remaining[i]++;
      }
    }
    // Card-playing-only substitution: any TWO tokens replace one symbol.
    const available=remaining.flatMap((n,i)=>Array.from({length:n},()=>i));
    for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){
      const a=available[i],b=available[j];
      remaining[a]--;remaining[b]--;
      if(matches(index+1,remaining))return true;
      remaining[a]++;remaining[b]++;
    }
    return false;
  }
  const rem=FOOD.map(f=>payment.filter(x=>x===f).length);
  return matches(0,rem);
}
/** Return a single explicitly computable legal payment for AI/second-bird use. */
export function findFoodPayment(owned,card){
  const types=FOOD.flatMap(f=>Array.from({length:owned[f]},()=>f));
  // A card requires at most three food symbols (or one if alternative).
  for(let k=0;k<=Math.min(types.length,6);k++){
    function pick(from,left,result){
      if(!left)return satisfiesCost(card,result)?result:null;
      for(let i=from;i<=types.length-left;i++){
        const t=pick(i+1,left-1,[...result,types[i]]);
        if(t)return t;
      }
      return null;
    }
    const candidate=pick(0,k,[]);
    if(candidate)return candidate;
  }
  return null;
}
function selectDie(s,pick){
  if(pick?.reroll){
    check(canReroll(s.feeder),"Reroll requires all remaining dice to show the same face");
    rollFeeder(s);
  }
  if(!s.feeder.length)rollFeeder(s);
  check(pick&&Number.isInteger(pick.index)&&pick.index>=0&&
    pick.index<s.feeder.length,"Choose a die currently in the birdfeeder");
  const face=s.feeder[pick.index];
  const food=pick.food??(face==="dual"?"invertebrate":face);
  check(face==="dual"?["invertebrate","seed"].includes(food):food===face,
    "The selected die does not show that food");
  s.feeder.splice(pick.index,1);
  return food;
}
function canReroll(feeder){
  return feeder.length>0&&feeder.every(face=>face===feeder[0]);
}
function refillTray(s){
  const empties=3-s.tray.length;
  for(let i=0;i<empties;i++){
    const bird=drawBird(s,null);
    if(bird!==null)s.tray.push(bird);
  }
}
function addPowerQueue(s,player,habitat,kind,event={}){
  const birds=s.players[player].habitats[habitat];
  // The activated habitat triggers optional powers from RIGHT to LEFT.
  for(let i=birds.length-1;i>=0;i--){
    const bird=BIRDS[birds[i].id];
    if(bird.powerType===kind && bird.powerCode && powerAvailable(s,{
      owner:player,habitat,index:i,birdId:bird.id,timing:kind,event
    })){
      s.pending.push({owner:player,habitat,index:i,birdId:bird.id,
        code:bird.powerCode,timing:kind,event});
    }
  }
}
function reactPink(s,event){
  for(let i=0;i<s.players.length;i++){
    if(i===event.actor)continue;
    for(const habitat of HABITATS){
      const birds=s.players[i].habitats[habitat];
      for(let j=0;j<birds.length;j++){
        const bird=BIRDS[birds[j].id];
        if(bird.powerType!=="pink"||!bird.powerCode||
          s.players[i].pinkUsed.includes(bird.id))continue;
        const pending={owner:i,habitat,index:j,birdId:bird.id,
          code:bird.powerCode,timing:"pink",event};
        if(powerAvailable(s,pending))s.pending.push(pending);
      }
    }
  }
}
function endRound(s){
  const goal=s.goals[s.round-1].face;
  const scores=roundGoalScores(s.players,goal,s.round,s.goalMode);
  scores.forEach((v,i)=>s.players[i].goalPoints.push(v));
  if(s.round===4){
    s.phase="gameover";s.pending=[];return;
  }
  s.round++;
  s.starter=(s.starter+1)%s.players.length;
  s.currentPlayer=s.starter;
  s.remaining=s.players.map(()=>ROUND_ACTIONS[s.round-1]);
  // The last action of a round may have ended in a brown/pink power phase;
  // the next round must always begin in the ordinary action phase.
  s.phase="play";
  s.players[s.currentPlayer].pinkUsed=[];
  // All face-up birds are discarded and three new ones revealed.
  s.birdDiscard.push(...s.tray);
  s.tray=[];
  refillTray(s);
  s.lastEvent={type:"round",round:s.round};
}
function finishTurn(s){
  s.pending=[];
  s.turnContext=null;
  s.turn++;
  if(s.remaining.every(x=>x===0)){
    // The publisher's round-end procedure DISCARDS the remaining face-up
    // birds BEFORE restocking. Never draw replacements immediately before
    // that discard, or they will be silently removed and change deck odds.
    endRound(s);return;
  }
  refillTray(s);
  let next=s.currentPlayer;
  do{next=(next+1)%s.players.length;}while(s.remaining[next]===0);
  s.currentPlayer=next;
  s.players[next].pinkUsed=[];
  s.phase="play";
}
function finishOrResolve(s){
  if(s.pending.length){s.phase="power";return;}
  finishTurn(s);
}
function activate(s,action){
  const p=emptySlot(s);
  const actor=s.currentPlayer;
  check(s.remaining[actor]>0,"No action cubes remaining");
  check(["playBird","gainFood","layEggs","drawBirds"].includes(action.type),
    "Unknown Wingspan main action");
  if(action.type==="playBird"){
    const id=action.birdId,habitat=action.habitat;
    check(Number.isInteger(id)&&p.hand.includes(id),"Bird must be in your hand");
    const bird=BIRDS[id];
    check(HABITATS.includes(habitat)&&bird.habitats.includes(habitat),
      "Bird cannot occupy that habitat");
    const row=p.habitats[habitat];
    check(row.length<5,"Habitat is full");
    check(satisfiesCost(bird,action.payment??[]),"Food payment doesn't satisfy this bird's cost");
    const eggCount=EGG_COLUMN_COST[row.length];
    removeEggs(s,actor,action.eggs??[],eggCount);
    useFood(s,actor,action.payment??[]);
    p.hand.splice(p.hand.indexOf(id),1);
    row.push(unitBird(id));
    s.lastEvent={type:"playBird",actor,id,habitat};
    if(bird.powerType==="white"&&bird.powerCode)
      s.pending.push({owner:actor,habitat,index:row.length-1,
        birdId:id,code:bird.powerCode,timing:"white",event:s.lastEvent});
    reactPink(s,s.lastEvent);
  } else if(action.type==="gainFood") {
    const habitat="forest";
    const birdCount=p.habitats[habitat].length;
    const extra=!!action.extra;
    const quantity=RESOURCE_PROGRESSION.forest[birdCount]+(extra?1:0);
    check(!extra||birdCount%2===1,"This forest column has no extra-food conversion");
    if(extra){
      check(Number.isInteger(action.discardCard)&&p.hand.includes(action.discardCard),
        "Discard a hand card for an additional die");
      p.hand.splice(p.hand.indexOf(action.discardCard),1);
      s.birdDiscard.push(action.discardCard);
    }
    check(Array.isArray(action.dice)&&action.dice.length===quantity,
      "Select exactly "+quantity+" food dice");
    if(action.reroll){
      check(canReroll(s.feeder),"Reroll requires identical remaining feeder dice");
      rollFeeder(s);
    }
    const obtained=[];
    for(const pick of action.dice){
      const food=selectDie(s,pick);
      p.food[food]++;
      obtained.push(food);
    }
    s.lastEvent={type:"gainFood",actor,foods:obtained};
    addPowerQueue(s,actor,habitat,"brown",s.lastEvent);
    reactPink(s,s.lastEvent);
  } else if(action.type==="layEggs") {
    const habitat="grassland";
    const count=p.habitats[habitat].length;
    const extra=!!action.extra;
    const quantity=RESOURCE_PROGRESSION.grassland[count]+(extra?1:0);
    check(!extra||count%2===1,"This grassland column has no extra-egg conversion");
    if(extra){
      check(FOOD.includes(action.payment),"Pay one food for the extra egg");
      useFood(s,actor,[action.payment]);
    }
    check(Array.isArray(action.targets),"Specify egg placement locations");
    const total=action.targets.reduce((n,x)=>n+x.count,0);
    check(total<=quantity,"Too many eggs for this grassland action");
    let laid=0;
    for(const target of action.targets){
      check(HABITATS.includes(target.habitat)&&
        Number.isInteger(target.index)&&Number.isInteger(target.count)&&
        target.count>0,"Invalid egg target");
      const capacity=p.habitats[target.habitat]?.[target.index];
      check(capacity,"No bird at egg destination");
      const amount=addEggs(s,actor,target.habitat,target.index,target.count);
      check(amount===target.count,"Egg placement exceeds capacity or supply");
      laid+=amount;
    }
    s.lastEvent={type:"layEggs",actor,count:laid};
    addPowerQueue(s,actor,habitat,"brown",s.lastEvent);
    reactPink(s,s.lastEvent);
  } else if(action.type==="drawBirds") {
    const habitat="wetland";
    const count=p.habitats[habitat].length;
    const extra=!!action.extra;
    const quantity=RESOURCE_PROGRESSION.wetland[count]+(extra?1:0);
    check(!extra||count%2===1,"This wetland column has no extra-card conversion");
    if(extra)removeEggs(s,actor,action.eggSource?[action.eggSource]:[],1);
    check(Array.isArray(action.draws)&&action.draws.length<=quantity,
      "Too many cards selected");
    for(const draw of action.draws){
      if(draw==="deck"){
        drawBird(s,actor);
      } else {
        check(Number.isInteger(draw)&&draw>=0&&draw<s.tray.length,
          "Invalid face-up card choice");
        const id=s.tray[draw];
        check(id!==null,"That displayed card was already taken");
        p.hand.push(id);
        s.tray[draw]=null;
      }
    }
    s.tray=s.tray.filter(x=>x!==null);
    s.lastEvent={type:"drawBirds",actor,count:action.draws.length};
    addPowerQueue(s,actor,habitat,"brown",s.lastEvent);
  }
  s.remaining[actor]--;
  s.turnContext={main:action.type,actor};
  finishOrResolve(s);
}
export function powerChoices(s){
  check(s.phase==="power"&&s.pending.length,"No pending powers");
  const effect=s.pending[0];
  const required=[1000,1008,1013].includes(effect.code);
  // A player can decline to activate a bird's power, but cannot decline
  // a card discard or card selection already made mandatory by that choice.
  return [...(required?[]:[{type:"skip",label:"Skip optional power"}]),
    ...powerOptions(s,effect)];
}
export function applyAction(state,action){
  check(action&&typeof action==="object","Specify an action");
  const s=cloneGame(state);
  if(s.phase==="setup"){
    check(action.type==="setup","Finish your starting hand first");
    const p=emptySlot(s);
    check(!p.setupDone,"Already completed setup");
    check(Array.isArray(action.keep)&&
      new Set(action.keep).size===action.keep.length &&
      action.keep.every(id=>p.hand.includes(id)),
      "Specify which starting birds to keep");
    check(p.bonusOffer.includes(action.bonusId),"Choose one offered starting bonus");
    check(Array.isArray(action.foodDiscard) &&
      action.foodDiscard.length===action.keep.length &&
      new Set(action.foodDiscard).size===action.foodDiscard.length &&
      action.foodDiscard.every(f=>FOOD.includes(f)),
      "Discard one distinct starting food for each kept bird");
    const rejected=p.hand.filter(id=>!action.keep.includes(id));
    s.birdDiscard.push(...rejected);
    p.hand=[...action.keep];
    for(const food of action.foodDiscard)p.food[food]--;
    const unwanted=p.bonusOffer.filter(id=>id!==action.bonusId);
    s.bonusDiscard.push(...unwanted);
    p.bonuses=[action.bonusId];p.bonusOffer=[];
    p.setupDone=true;
    const next=s.players.findIndex(x=>!x.setupDone);
    if(next>=0)s.currentPlayer=next;
    else{s.phase="play";s.currentPlayer=s.starter;}
    s.lastEvent={type:"setup",actor:state.currentPlayer};
  } else if(s.phase==="play"){
    activate(s,action);
  } else if(s.phase==="power"){
    check(action.type==="power","Resolve the optional bird power");
    const pending=s.pending.shift();
    if(action.skip)
      check(![1000,1008,1013].includes(pending.code),
        "Complete the revealed card selection");
    if(!action.skip)applyPower(s,pending,action.choice??{},{ 
      drawBird,drawBonus,drawFromDeck,rollFeeder,selectDie,addEggs,
      removeEggs,useFood,refillTray,reactPink,rng,
      playFreeBird:(st,owner,request)=>{
        const bird=BIRDS[request.birdId];
        const habitat=request.habitat;
        const p=st.players[owner];
        check(p.hand.includes(request.birdId)&&
          bird.habitats.includes(habitat),"Invalid second bird");
        const row=p.habitats[habitat];
        check(row.length<5,"Habitat full");
        const eggCost=EGG_COLUMN_COST[row.length];
        const eggSources=[];
        let left=eggCost;
        for(const h of HABITATS)
          for(let i=0;i<p.habitats[h].length&&left;i++){
            const q=Math.min(left,p.habitats[h][i].eggs);
            if(q){eggSources.push({habitat:h,index:i,count:q});left-=q;}
          }
        check(!left,"Second bird needs "+eggCost+" eggs");
        const payment=findFoodPayment(p.food,bird);
        check(payment!==null,"Cannot pay food to play second bird");
        removeEggs(st,owner,eggSources,eggCost);
        useFood(st,owner,payment);
        p.hand.splice(p.hand.indexOf(request.birdId),1);
        row.push(unitBird(request.birdId));
        if(bird.powerType==="white"&&bird.powerCode)
          st.pending.unshift({owner,habitat,index:row.length-1,
            birdId:bird.id,code:bird.powerCode,timing:"white",
            event:{type:"playBird",actor:owner,id:bird.id,habitat}});
        reactPink(st,{type:"playBird",actor:owner,id:bird.id,habitat});
      }
    });
    if(pending.timing==="pink" && !action.skip){
      s.players[pending.owner].pinkUsed.push(pending.birdId);
    }
    finishOrResolve(s);
  }else fail("The Wingspan game has ended");
  assertValid(s);
  return s;
}
export function assertValid(s){
  check(s.version===1&&["digital","physical"].includes(s.mode),"Unsupported state");
  check(["setup","play","power","gameover"].includes(s.phase),"Bad game phase");
  check(Array.isArray(s.players)&&s.players.length>=2&&s.players.length<=5,
    "Wrong player count");
  check(s.round>=1&&s.round<=4,"Bad round");
  check(s.currentPlayer>=0&&s.currentPlayer<s.players.length,"Bad current player");
  check(s.remaining.length===s.players.length &&
    s.remaining.every(n=>Number.isInteger(n)&&n>=0&&n<=ROUND_ACTIONS[s.round-1]),
    "Bad round action counts");
  check(s.goals.length===4&&
    new Set(s.goals.map(g=>g.tile)).size===4,"Duplicate goal tile");
  check(s.eggSupply>=0&&s.eggSupply<=75,"Bad egg supply");
  check(Array.isArray(s.feeder)&&s.feeder.length<=5&&
    s.feeder.every(f=>FEEDER_FACES.includes(f)),"Bad birdfeeder");
  const cards=[];
  const bonus=[];
  const addCards=arr=>{for(const c of arr){check(Number.isInteger(c)&&c>=0&&c<BIRDS.length,"Invalid bird ID");cards.push(c);}};
  for(const p of s.players){
    check(Array.isArray(p.hand)&&p.hand.length<=BIRDS.length,"Bad hand");
    addCards(p.hand);
    check(FOOD.every(f=>Number.isInteger(p.food[f])&&p.food[f]>=0),"Invalid food inventory");
    for(const h of HABITATS){
      const entries=p.habitats[h];
      check(Array.isArray(entries)&&entries.length<=5,"Overfull habitat");
      for(const e of entries){
        check(validBirdEntry(e),"Invalid placed bird");
        check(BIRDS[e.id].habitats.includes(h),"Bird in prohibited habitat");
        check(e.eggs<=BIRDS[e.id].eggs,"Excess eggs on bird");
        cards.push(e.id);
        addCards(e.tucked);
      }
    }
    bonus.push(...p.bonuses,...p.bonusOffer);
  }
  addCards(s.deck);addCards(s.birdDiscard);addCards(s.tray);
  // Temporary offers have left a deck but aren't yet in anyone's hand.
  for(const offer of s.pending){
    if(offer.code===1008)addCards(offer.event.cards);
    if(offer.code===1013)bonus.push(...offer.event.cards);
  }
  check(cards.length===170&&new Set(cards).size===170,"Bird cards lost or duplicated");
  bonus.push(...s.bonusDeck,...s.bonusDiscard);
  check(bonus.length===26&&new Set(bonus).size===26,"Bonus cards lost or duplicated");
  check(totalEggs({habitats:Object.fromEntries(HABITATS.map(h=>[
    h,s.players.flatMap(p=>p.habitats[h])
  ]))})+s.eggSupply===75,"Egg supply not conserved");
  if(s.phase==="setup")check(s.players.some(p=>!p.setupDone),"Setup finished but phase not changed");
  if(s.phase==="power")check(s.pending.length>0,"Power phase requires a pending effect");
  if(s.phase==="gameover")check(s.round===4&&s.remaining.every(x=>x===0),"Game ended early");
  return true;
}
export function gameSummary(s){
  return {round:s.round,phase:s.phase,currentPlayer:s.currentPlayer,
    actionsLeft:s.remaining[s.currentPlayer],
    scores:s.players.map(scorePlayer),
    winner:s.phase==="gameover"?finalOutcome(s.players):null};
}
export function publicObservation(s,viewer=null){
  const result=cloneGame(s);
  result.deckCount=s.deck.length;
  result.bonusDeckCount=s.bonusDeck.length;
  // Bonus objectives discarded during setup or white powers are hidden.
  // Publishing the underlying IDs would reveal opponents' discarded goals.
  result.bonusDiscardCount=s.bonusDiscard.length;
  delete result.bonusDiscard;
  delete result.deck;
  delete result.bonusDeck;
  delete result.rngState;
  for(let i=0;i<result.players.length;i++){
    if(i===viewer)continue;
    const player=result.players[i];
    player.handCount=player.hand.length;
    player.privateBonusCount=player.bonuses.length;
    player.bonusOfferCount=player.bonusOffer.length;
    player.hand=[];
    player.bonuses=[];
    player.bonusOffer=[];
  }
  // Hide unresolved private card selections when a different player is
  // viewing the board. This projection is for analysis only, not mutations.
  result.pending=result.pending.map(effect=>{
    if(effect.owner===viewer||!effect.event?.cards)return effect;
    return {...effect,event:{...effect.event,
      cards:undefined,cardCount:effect.event.cards.length}};
  });
  // Tucked cards are physically FACE DOWN. Their count is public, but the
  // species identities must never be exposed to the analysis worker.
  for(const player of result.players)
    for(const habitat of HABITATS)
      for(const bird of player.habitats[habitat]){
        bird.tuckedCount=bird.tucked.length;
        bird.tucked=Array(bird.tuckedCount).fill(null);
      }
  return result;
}
export const getBird=id=>BIRDS[id];
export const hasPower=id=>!!BIRDS[id]?.powerCode;
