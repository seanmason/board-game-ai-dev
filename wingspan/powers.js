import {BIRDS,BONUSES} from "./catalog.js";
import {FOOD,HABITATS,totalEggs} from "./scoring.js";
import {findFoodPayment,EGG_COLUMN_COST} from "./core.js";

const CODES=new Set([...BIRDS.map(b=>b.powerCode)].filter(x=>x>0));
const FOOD_CODES={
  5:["wild",1],6:["seed",3],14:null,16:["fruit",1],
  25:["invertebrate",1],29:["fish",3],33:["wild",2],
  40:["invertebrate",1],57:["fruit",1],60:["fish",1],
  63:["seed",1],66:["seed",1]
};
const FEEDER_CODES={1:"seed",11:"any",15:"fish",22:"any",
  45:"invertebrate",48:"any",53:["invertebrate","fruit"],
  58:"invertebrate",64:["seed","fruit"]};
const EGG_CODES={
  2:"ground",12:"cavity",14:"any",18:"cavity",26:"ground",
  28:"bowl",30:"self",52:"platform",54:"bowl",
  61:"cavity",65:"bowl",67:"ground"
};
const DRAW_COUNTS={3:1,8:0,13:0,21:1,24:2,34:2,41:2,56:1,59:1};
const TUCK_FROM_HAND=new Set([4,27,32,35,50,62]);
const TUCK_FROM_DECK={9:2,23:2,36:2};
const PREDATOR_DICE={7:"rodent",10:"fish"};
const PREDATOR_CARD={17:75,42:100,46:50};
const EXTRA_BIRD_HABITAT={37:["forest"],38:["grassland"],
  44:["wetland"],51:["forest","grassland"]};
const PINK_CODES=new Set([2,18,19,22,28,39,50,55]);
const ALL_PLAYER_FOOD={16:"fruit",40:"invertebrate",60:"fish",63:"seed"};
const ALL_PLAYER_CARD=new Set([59]);
const ALL_PLAYER_EGGS={54:"bowl",61:"cavity",67:"ground"};
const powerLabel=(code)=>({
  1:"Cache seed from feeder",2:"Lay an egg on another ground-nest bird",
  3:"Wetland player(s) with fewest birds draw",4:"Tuck hand bird and draw",
  5:"Exchange another bird's egg for food",6:"Gain three seeds",
  7:"Roll outside-feeder dice for cached rodent",8:"Share a revealed bird-card draw",
  9:"Spend fish to tuck two hidden birds",10:"Roll outside-feeder dice for cached fish",
  11:"Share a birdfeeder food pick with every player",
  12:"Egg on each cavity nest",13:"Draw two bonuses, retain one",
  14:"Lay one egg on any bird",15:"Take all fish dice",
  16:"All players gain fruit",17:"Attempt to tuck a small drawn bird",
  18:"Other player laid eggs: add egg on another cavity nest",
  19:"Other player placed a wetland bird: gain fish",
  20:"Move rightmost bird into a different habitat",
  21:"Draw bird then discard a bird",22:"Other predator succeeds: gain feeder food",
  23:"Spend seed to tuck two birds",24:"Draw two birds",
  25:"Gain an invertebrate",26:"Egg on each ground nest",
  27:"Tuck hand bird and lay an egg",28:"Other player laid eggs: bowl-nest egg",
  29:"Gain three fish",30:"Lay egg on this bird",
  31:"Cache a seed from supply",32:"Tuck hand bird and gain fruit",
  33:"Trade another bird's egg for two foods",34:"Draw two then discard one",
  35:"Tuck hand bird and gain seed",36:"Spend fish to tuck two birds",
  37:"Play another forest bird",38:"Play another grassland bird",
  39:"Another player placed forest bird: gain invertebrate",
  40:"All players gain an invertebrate",41:"Spend an egg to draw two",
  42:"Attempt to tuck a drawn bird under 100cm",
  43:"Repeat a brown power in this habitat",44:"Play another wetland bird",
  45:"Take invertebrate from feeder",46:"Attempt to tuck a drawn bird under 50cm",
  47:"Exchange a food token",48:"Fewest forest birds gain feeder food",
  49:"Repeat a predator power in this habitat",50:"Other grassland bird: tuck from hand",
  51:"Play another grassland or forest bird",
  52:"Egg on each platform nest",53:"Take invertebrate or fruit from feeder",
  54:"All players lay bowl egg, owner may add another",
  55:"Other player gained a rodent: cache rodent",
  56:"Draw one bird",57:"Gain fruit",58:"Take all invertebrate dice",
  59:"All players draw a bird",60:"All players gain fish",
  61:"All players lay cavity egg, owner may add another",
  62:"Tuck hand bird and gain insect or seed",
  63:"All players gain seed",64:"Take seed or fruit from feeder",
  65:"Lay an egg on each bowl nest",66:"Gain a seed",
  67:"All players lay ground egg, owner may add another"
})[code]??"Resolve optional power";

export function powerDescription(code){return powerLabel(code);}
const playerBirds=(s,owner,filter=()=>true)=>{
  const result=[];
  for(const h of HABITATS)
    s.players[owner].habitats[h].forEach((e,index)=>{
      if(filter(e,h,index))result.push({habitat:h,index,id:e.id});
    });
  return result;
};
const nestMatches=(entry,nest)=>nest==="any"||
  entry&&[nest,"wild"].includes(BIRDS[entry.id].nest);
const eggTargets=(s,owner,nest="any",exceptId=null)=>
  playerBirds(s,owner,e=>e.id!==exceptId&&nestMatches(e,nest)&&e.eggs<BIRDS[e.id].eggs)
    .map(x=>({...x,capacity:BIRDS[x.id].eggs-
      s.players[owner].habitats[x.habitat][x.index].eggs}));
const eggSources=(s,owner,exceptId=null)=>
  playerBirds(s,owner,e=>e.id!==exceptId&&e.eggs>0);
const knownFeederFaces=s=>{
  const options=[];
  for(let index=0;index<s.feeder.length;index++){
    const f=s.feeder[index];
    for(const food of f==="dual"?["invertebrate","seed"]:[f])
      options.push({index,food,label:food+" (die "+(index+1)+")"});
  }
  return options;
};
function choice(label,fields={}){return {label,choice:fields};}
function gainFoodOptions(s,types){
  return (types==="wild"?FOOD:Array.isArray(types)?types:[types])
    .map(food=>choice("Take "+food,{food}));
}
function feederOptions(s,required="any"){
  const faces=knownFeederFaces(s).filter(f=>
    required==="any"||(Array.isArray(required)?
      required.includes(f.food):f.food===required));
  if(!s.feeder.length)return [choice("Refill birdfeeder",{refill:true})];
  return faces.map(x=>choice("Take "+x.label,{index:x.index,food:x.food}));
}
function handChoices(s,p){
  return s.players[p].hand.map(id=>choice("Use "+BIRDS[id].name,{cardId:id}));
}
function eggsForPower(s,p,nest="any",except=null){
  return eggTargets(s,p,nest,except).map(x=>choice(
    "Lay on "+BIRDS[x.id].name,{habitat:x.habitat,index:x.index}));
}
function foodPaymentChoices(s,p,amount=1,need=null){
  return FOOD.filter(food=>s.players[p].food[food]>=amount &&
    (!need||need.includes(food))).map(food=>choice(
    "Spend "+amount+" "+food,{food}));
}
export function powerAvailable(s,p){
  const code=p.code??BIRDS[p.birdId]?.powerCode;
  if(p.timing==="pink"){
    if(!PINK_CODES.has(code))return false;
    const event=p.event;
    if(code===2||code===18||code===28)
      return event.type==="layEggs";
    if(code===19)return event.type==="playBird"&&event.habitat==="wetland";
    if(code===39)return event.type==="playBird"&&event.habitat==="forest";
    if(code===50)return event.type==="playBird"&&event.habitat==="grassland";
    if(code===55)return event.type==="gainFood"&&event.foods?.includes("rodent");
    if(code===22)return event.type==="predatorSuccess";
    return false;
  }
  return code>0;
}
export function powerOptions(s,p){
  const c=p.code,owner=p.owner,instance=s.players[owner].habitats[p.habitat]?.[p.index];
  if(!instance && c<1000)return [];
  if(c===1008){
    return p.event.cards.map(id=>choice("Keep "+BIRDS[id].name,{cardId:id}));
  }
  if(c===1013){
    return p.event.cards.map(id=>choice("Retain "+BONUSES[id].name,{bonusId:id}));
  }
  if(c===1011){
    return feederOptions(s,"any");
  }
  if(c===1054){
    const targets=eggsForPower(s,owner,p.event.nest);
    const excluded=p.event.exclude;
    return excluded?targets.filter(x=>x.choice.habitat!==excluded.habitat||
      x.choice.index!==excluded.index):targets;
  }
  if(c===1000){
    return [choice("Discard a card",{cardId:s.players[owner].hand[0]})]
      .filter(x=>x.choice.cardId!==undefined)
      .concat(handChoices(s,owner));
  }
  if(c===11)
    return s.players.map((_,i)=>choice("Let player "+(i+1)+
      " choose food first",{firstPlayer:i}));
  if(c===48)return [choice("Begin food picks for players with fewest forest birds",{})];
  if(c===8||c===13)return [choice("Reveal available choices",{})];
  if(c===3||c===59||DRAW_COUNTS[c])return [choice("Draw cards",{})];
  if(c===15||c===58)return [choice("Take all matching feeder dice",{})];
  if(c===5)
    return eggSources(s,owner,p.birdId).flatMap(x=>
      FOOD.map(food=>choice("Trade egg on "+BIRDS[x.id].name+
        " for "+food,{habitat:x.habitat,index:x.index,food})));
  if(c===33)
    return eggSources(s,owner,p.birdId).flatMap(x=>
      FOOD.flatMap((a,i)=>FOOD.slice(i).map(b=>
        choice("Trade egg for "+a+" + "+b,{
          habitat:x.habitat,index:x.index,foods:[a,b]
        }))));
  if(c===1)return feederOptions(s,"seed").flatMap(item=>[
    choice(item.label+" and keep the food",{...item.choice,cache:false}),
    choice(item.label+" and cache on bird",{...item.choice,cache:true})
  ]);
  if(FEEDER_CODES[c])return feederOptions(s,FEEDER_CODES[c]);
  if(FOOD_CODES[c]||c===19||c===39)return gainFoodOptions(s,
    c===19?"fish":c===39?"invertebrate":FOOD_CODES[c][0]);
  if(c===31)return [choice("Cache a seed",{})];
  if(c===55)return [choice("Cache a rodent",{})];
  if(EGG_CODES[c]){
    if(c===30)
      return instance.eggs<BIRDS[instance.id].eggs?
        [choice("Lay on this bird",{habitat:p.habitat,index:p.index})]:[];
    if([12,26,52,65].includes(c))return [choice("Lay on all matching nests",{})];
    if(ALL_PLAYER_EGGS[c])return [choice("Offer eggs to all players",{})];
    return eggsForPower(s,owner,EGG_CODES[c],c===2||c===18||c===28?p.birdId:null);
  }
  if(c===34||c===21)return [choice("Draw, then discard",{})];
  if(c===41)return eggSources(s,owner).map(x=>choice(
    "Spend egg on "+BIRDS[x.id].name,{habitat:x.habitat,index:x.index}));
  if(c===62)
    return s.players[owner].hand.flatMap(id=>
      ["invertebrate","seed"].map(food=>
        choice("Tuck "+BIRDS[id].name+" for "+food,{cardId:id,food})));
  if(TUCK_FROM_HAND.has(c))return handChoices(s,owner);
  if(TUCK_FROM_DECK[c]){
    const need=c===23?"seed":"fish";
    return foodPaymentChoices(s,owner,1,[need]);
  }
  if(c===47){
    return FOOD.flatMap(from=>s.players[owner].food[from]?
      FOOD.filter(to=>from!==to).map(to=>choice(
        "Exchange "+from+" for "+to,{from,to})) : []);
  }
  if(PREDATOR_DICE[c]||PREDATOR_CARD[c])return [choice("Attempt hunting",{})];
  if(c===43||c===49){
    return playerBirds(s,owner,(b,h,i)=>h===p.habitat&&i!==p.index&&
      BIRDS[b.id].powerType==="brown"&&BIRDS[b.id].powerCode!==43&&
      BIRDS[b.id].powerCode!==49&&
      (c!==49||["hunting/fishing"].includes(BIRDS[b.id].powerGroup)))
      .map(x=>choice("Repeat "+BIRDS[x.id].name,{index:x.index}));
  }
  if(c===20){
    const line=s.players[owner].habitats[p.habitat];
    if(line.at(-1)?.id!==instance.id)return [];
    return HABITATS.filter(h=>h!==p.habitat&&
      s.players[owner].habitats[h].length<5&&BIRDS[instance.id].habitats.includes(h))
      .map(h=>choice("Move to "+h,{habitat:h}));
  }
  if(EXTRA_BIRD_HABITAT[c]){
    const result=[],player=s.players[owner];
    for(const id of player.hand){
      const bird=BIRDS[id];
      // The second bird costs normal food AND eggs, so don't offer a
      // superficially legal habitat choice that cannot be completed.
      if(findFoodPayment(player.food,bird)===null)continue;
      for(const h of EXTRA_BIRD_HABITAT[c]){
        const count=player.habitats[h].length;
        if(!bird.habitats.includes(h)||count>=5)continue;
        if(totalEggs(player)<EGG_COLUMN_COST[count])continue;
        result.push(choice("Play "+bird.name+" in "+h,
          {birdId:id,habitat:h}));
      }
    }
    return result;
  }
  return []; // Not a valid no-op: explicit unsupported effect if requested.
}
const ASSERT=(ok,msg)=>{if(!ok)throw Error(msg);};
export function applyPower(s,p,selected,help){
  const c=p.code,owner=p.owner;
  const identity=EXTRA_BIRD_HABITAT[c]?{birdId:selected.birdId,habitat:selected.habitat}:selected;
  const valid=powerOptions(s,p).some(x=>
    JSON.stringify(x.choice)===JSON.stringify(identity));
  ASSERT(valid,"Unsupported or invalid power choice for "+BIRDS[p.birdId]?.name);
  const actor=s.players[owner],instance=actor.habitats[p.habitat]?.[p.index];
  const supply=(food,count=1,receiver=owner)=>{
    ASSERT(FOOD.includes(food),"Invalid food");
    s.players[receiver].food[food]+=count;
  };
  const addCached=(food)=>{instance.cached.push(food);};
  const putEgg=(target,player=owner)=>{
    const amount=help.addEggs(s,player,target.habitat,target.index,1);
    return amount;
  };
  const requestDiscard=(count)=>{
    // The power says "at the end of your turn". Process this mandatory
    // discard AFTER any other birds' activated powers, not immediately.
    s.pending.push({...p,code:1000,event:{remaining:count}});
  };
  const takeFood=()=>{
    if(selected.refill) {
      help.rollFeeder(s);
      s.pending.unshift(p);
      return null;
    }
    return help.selectDie(s,selected);
  };
  if(c===1008){
    const cards=p.event.cards.filter(id=>id!==selected.cardId);
    s.players[owner].hand.push(selected.cardId);
    const remaining=p.event.remaining??[];
    if(remaining.length){
      s.pending.unshift({...p,owner:remaining[0],
        event:{cards,initial:p.event.initial,
          remaining:remaining.slice(1)}});
    }else{
      // The original active player takes the remaining extra card.
      if(cards.length)s.players[p.event.initial].hand.push(cards[0]);
    }
    return;
  }
  if(c===1013){
    actor.bonuses.push(selected.bonusId);
    s.bonusDiscard.push(...p.event.cards.filter(id=>id!==selected.bonusId));
    return;
  }
  if(c===1011){
    const food=takeFood();
    if(food!==null)s.players[owner].food[food]++;
    const remaining=p.event.remaining??[];
    if(food!==null&&remaining.length){
      s.pending.unshift({...p,owner:remaining[0],
        event:{remaining:remaining.slice(1)}});
    }
    return;
  }
  if(c===1054){
    putEgg(selected);
    if(!p.event.secondary){
      // The owner may put the *additional* egg on another bird, never
      // the same bird which already received the first egg.
      const extra=s.pending.find(next=>next.code===1054&&
        next.owner===owner&&next.event?.secondary&&
        next.birdId===p.birdId);
      if(extra)extra.event.exclude={
        habitat:selected.habitat,index:selected.index
      };
    }
    return;
  }
  if(c===1000){
    const idx=actor.hand.indexOf(selected.cardId);
    ASSERT(idx>=0,"Discard a hand bird");
    actor.hand.splice(idx,1);s.birdDiscard.push(selected.cardId);
    return;
  }
  if(c===8){
    const cards=[];
    for(let i=0;i<s.players.length+1;i++){
      const id=help.drawFromDeck(s,"bird");if(id!==null)cards.push(id);
    }
    if(cards.length){
      const order=Array.from({length:s.players.length-1},(_,i)=>
        (owner+i+1)%s.players.length);
      s.pending.unshift({...p,code:1008,
        event:{cards,initial:owner,remaining:order}});
    }
    return;
  }
  if(c===13){
    const cards=[];
    for(let i=0;i<2;i++){const id=help.drawFromDeck(s,"bonus",{owner,hidden:true});if(id!==null)cards.push(id);}
    if(cards.length)s.pending.unshift({...p,code:1013,event:{cards}});
    return;
  }
  if(c===11||c===48){
    const players=c===11?
      Array.from({length:s.players.length},(_,i)=>
        (selected.firstPlayer+i)%s.players.length):
      s.players.map((pl,i)=>({i,n:pl.habitats.forest.length}))
        .filter(x=>x.n===Math.min(...s.players.map(p=>p.habitats.forest.length)))
        .map(x=>x.i);
    if(players.length)s.pending.unshift({...p,code:1011,
      owner:players[0],event:{remaining:players.slice(1)}});
    return;
  }
  if(c===15||c===58){
    const needed=c===15?"fish":"invertebrate";
    for(let i=s.feeder.length-1;i>=0;i--){
      const face=s.feeder[i];
      if(face===needed||(needed==="invertebrate"&&face==="dual")){
        actor.food[needed]++;s.feeder.splice(i,1);
      }
    }
    return;
  }
  if(c===5||c===33){
    help.removeEggs(s,owner,[{...selected,count:1}],1);
    if(c===33){
      ASSERT(Array.isArray(selected.foods)&&selected.foods.length===2,
        "Choose two independent food tokens");
      for(const food of selected.foods)supply(food);
    }else supply(selected.food);
    return;
  }
  if(FEEDER_CODES[c]){
    const food=takeFood();if(food===null)return;
    if(c===1 && selected.cache)addCached(food);
    else supply(food);
    return;
  }
  if(FOOD_CODES[c]||c===19||c===39){
    const count=FOOD_CODES[c]?.[1]??1;
    const food=selected.food;
    if(ALL_PLAYER_FOOD[c])for(let i=0;i<s.players.length;i++)s.players[i].food[food]+=count;
    else supply(food,count);
    return;
  }
  if(c===31||c===55){addCached(c===31?"seed":"rodent");return;}
  if(c===3){
    const least=Math.min(...s.players.map(x=>x.habitats.wetland.length));
    for(let i=0;i<s.players.length;i++)
      if(s.players[i].habitats.wetland.length===least)help.drawBird(s,i);
    return;
  }
  if(c===59){for(let i=0;i<s.players.length;i++)help.drawBird(s,i);return;}
  if(DRAW_COUNTS[c]){
    const count=DRAW_COUNTS[c];
    for(let i=0;i<count;i++)help.drawBird(s,owner);
    if([21,34].includes(c))requestDiscard(1);
    return;
  }
  if(EGG_CODES[c]){
    if([12,26,52,65].includes(c)){
      for(const target of eggTargets(s,owner,EGG_CODES[c]))putEgg(target);
    }else if(ALL_PLAYER_EGGS[c]){
      const nest=ALL_PLAYER_EGGS[c];
      const targets=Array.from({length:s.players.length},(_,i)=>i)
        .filter(i=>eggTargets(s,i,nest).length);
      // Owner may lay an extra egg on a DIFFERENT matching bird.
      if(eggTargets(s,owner,nest).length>=2)targets.push(owner);
      for(let i=targets.length-1;i>=0;i--)
        s.pending.unshift({...p,code:1054,owner:targets[i],
          event:{nest,secondary:i===targets.length-1&&targets[i]===owner}});
    }else putEgg(selected);
    return;
  }
  if(c===41){
    help.removeEggs(s,owner,[{...selected,count:1}],1);
    help.drawBird(s,owner);help.drawBird(s,owner);
    return;
  }
  if(TUCK_FROM_HAND.has(c)){
    const id=selected.cardId;
    const pos=actor.hand.indexOf(id);
    ASSERT(pos>=0,"Card not in hand");
    actor.hand.splice(pos,1);
    instance.tucked.push(id);
    if(c===4)help.drawBird(s,owner);
    else if(c===27)help.addEggs(s,owner,p.habitat,p.index,1);
    else if(c===32)supply("fruit");
    else if(c===35)supply("seed");
    else if(c===62)supply(selected.food);
    return;
  }
  if(TUCK_FROM_DECK[c]){
    help.useFood(s,owner,[selected.food]);
    for(let i=0;i<TUCK_FROM_DECK[c];i++){
      const id=help.drawFromDeck(s,"bird",{owner,hidden:true});
      if(id!==null)instance.tucked.push(id);
    }
    return;
  }
  if(c===47){
    help.useFood(s,owner,[selected.from]);supply(selected.to);return;
  }
  if(PREDATOR_DICE[c]){
    const outside=5-s.feeder.length;
    let hit=false;
    const rolled=help.rollOutside?help.rollOutside(s):Array.from({length:outside},()=>
      ["invertebrate","seed","fish","fruit","rodent","dual"][Math.floor(help.rng(s)*6)]);
    for(const face of rolled){ // outside rolls never change feeder faces
      if(face===PREDATOR_DICE[c])hit=true;
    }
    if(hit){
      addCached(PREDATOR_DICE[c]);
      help.reactPink(s,{type:"predatorSuccess",actor:owner});
    }
    return;
  }
  if(PREDATOR_CARD[c]){
    const id=help.drawFromDeck(s,"bird");
    if(id!==null){
      if(BIRDS[id].wingspan<PREDATOR_CARD[c]){
        instance.tucked.push(id);
        help.reactPink(s,{type:"predatorSuccess",actor:owner});
      }else s.birdDiscard.push(id);
    }
    return;
  }
  if(c===20){
    const line=actor.habitats[p.habitat];
    const old=line.pop();
    actor.habitats[selected.habitat].push(old);
    return;
  }
  if(c===43||c===49){
    const target=actor.habitats[p.habitat][selected.index];
    s.pending.unshift({...p,index:selected.index,birdId:target.id,
      code:BIRDS[target.id].powerCode});
    return;
  }
  if(EXTRA_BIRD_HABITAT[c]){
    ASSERT(help.playFreeBird,"Power needs an extra bird-play handler");
    help.playFreeBird(s,owner,selected);
    return;
  }
  throw Error("Unimplemented Wingspan bird power "+c+" for "+BIRDS[p.birdId]?.name);
}
export function allPowerIdsHandled(){
  return [...CODES].filter(c=>!powerLabel(c)).length===0;
}
