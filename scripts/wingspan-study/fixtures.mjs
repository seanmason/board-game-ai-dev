import {newGame,assertValid,publicObservation} from '../../wingspan/core.js';
import {BIRDS} from '../../wingspan/catalog.js';
import {FOOD,HABITATS,allBirds} from '../../wingspan/scoring.js';
const entry=id=>({id,eggs:0,cached:[],tucked:[]});
const find=(code,h,used)=>BIRDS.find(b=>b.powerType==='brown'&&b.powerCode===code&&b.habitats.includes(h)&&!used.has(b.id));
/** Fixed mechanism fixtures, selected by catalog effects without evaluator imports. */
export function diagnosticPositions(){
 const specs=[
 ['raven-alone', 'grassland',[33],1,0],['raven-supported','grassland',[33,30],1,1],
 ['raven-early','grassland',[33,14],1,1],['raven-late','grassland',[33,14],4,1],
 ['raven-saturated','grassland',[33,14],2,1,'saturated'],['raven-full','grassland',[33,14],2,1,'full'],
 ['gull-no-egg','wetland',[41],1,0],['gull-egg','wetland',[41],1,1],
 ['killdeer-demand','grassland',[41,14],2,1,'nohand'],['gull-saturated','grassland',[41,14],2,1],
 ['draw-tuck-forward','wetland',[27,56],2,0,'nohand'],['draw-tuck-reverse','wetland',[56,27],2,0,'nohand'],
 ['draw-tuck-forest','forest',[4,34],2,0,'nohand'],['draw-tuck-three','wetland',[27,4,56],3,0,'nohand'],
 ['food-tuck-forward','wetland',[9,60],2,0,'nofood'],['food-tuck-reverse','wetland',[60,9],2,0,'nofood'],
 ['repeat-food','grassland',[66,43],2,0,'nofood'],['repeat-no-target','forest',[43],2,0],
 ['predator-repeat','wetland',[17,49],2,0],['repeat-raven','grassland',[33,14,43],1,1],
 ['investment-stock','forest',[30],1,1],['investment-no-stock','forest',[30],1,0,'nofood'],
 ['late-control','grassland',[30],4,0,'last'],['capacity-control','grassland',[30],3,0,'full']
 ];
 return specs.map(([id,h,codes,round,eggs,mode],i)=>{
  const state=newGame({seed:810001+i}),p=state.players[0],used=new Set(),placed=codes.map(code=>{const b=id==='killdeer-demand'&&code===41?BIRDS[96]:find(code,h,used);if(!b)throw Error('No fixture bird '+id+' code '+code);used.add(b.id);return entry(b.id);});
  // Rehouse the entire original deck once: every card remains unique and present.
  const pool=[...state.deck,...state.tray,...state.birdDiscard,...state.players.flatMap(q=>q.hand)];
  for(const q of state.players){q.hand=[];q.setupDone=true;state.bonusDiscard.push(...q.bonusOffer.slice(1));q.bonuses.push(q.bonusOffer[0]);q.bonusOffer=[];}
  p.habitats[h]=placed;
  const candidates=BIRDS.filter(b=>!used.has(b.id)&&b.powerType==='brown').slice(0,3).map(b=>b.id);
  p.hand=mode==='nohand'||id.startsWith('food-tuck')?[]:candidates;for(const x of p.hand)used.add(x);
  state.tray=pool.filter(x=>!used.has(x)).slice(0,3);state.deck=pool.filter(x=>!used.has(x)&&!state.tray.includes(x));state.birdDiscard=[];
  p.food=Object.fromEntries(FOOD.map(f=>[f,mode==='nofood'?0:mode==='saturated'?9:1]));
  for(const e of placed)e.eggs=mode==='full'?BIRDS[e.id].eggs:Math.min(eggs,BIRDS[e.id].eggs);
  state.eggSupply=75-allBirds(p).reduce((n,e)=>n+e.eggs,0);state.round=round;state.remaining=[mode==='last'?1:Math.min(4,9-round),Math.min(4,9-round)];state.phase='play';state.currentPlayer=0;
  assertValid(state);publicObservation(state,0);
  return {id,state,description:`${id}: ${h}, codes ${codes.join('/')}, round ${round}, ${mode??'ordinary stock'}.`};
 });
}




