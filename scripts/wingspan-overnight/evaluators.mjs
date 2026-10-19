import {BIRDS} from '../../wingspan/catalog.js';
import {FOOD,HABITATS,allBirds} from '../../wingspan/scoring.js';
import {RESOURCE_PROGRESSION as RATE} from '../../wingspan/core.js';
import {knownCard} from '../../wingspan/observation-io.js';
import {evaluateLeaf,remainingActions} from '../../wingspan/leaf-evaluators.js';
import {evaluateStudyLeaf} from '../wingspan-study/evaluators.mjs';
const sum=a=>a.reduce((n,x)=>n+x,0),clip=(x,n=4)=>Math.max(-n,Math.min(n,x));
const clone=x=>structuredClone(x);
function ledger(state,player){
 const p=state.players[player],entries=allBirds(p).map(e=>({...e}));
 return {p,entries,food:{...p.food},cards:p.hand.length,points:0,supply:state.eggSupply??75,
  feeder:[...(state.feeder??[])],cardNeed:Math.max(0,Math.min(2,15-entries.length)),
  demand:Object.fromEntries(FOOD.map(f=>[f,sum(p.hand.map(id=>BIRDS[id]?.food[f]??0))]))};
}
function lay(l,n,filter=()=>true){for(const e of l.entries){if(!filter(e))continue;const k=Math.min(n,l.supply,BIRDS[e.id].eggs-e.eggs);e.eggs+=k;l.supply-=k;n-=k;if(!n)break;}}
function spendEgg(l,except){const e=l.entries.find(e=>e.id!==except&&e.eggs>0);if(!e)return false;e.eggs--;l.supply++;return true;}
function gainFood(l,types,n=1){for(let i=0;i<n;i++){const f=[...types].sort((a,b)=>(l.demand[b]-l.food[b])-(l.demand[a]-l.food[a])||FOOD.indexOf(a)-FOOD.indexOf(b))[0];l.food[f]++;}}
function base(l,h){const n=RATE[h][l.p.habitats[h].length];if(h==='grassland')lay(l,n);else if(h==='wetland')l.cards+=n;else for(let i=0;i<n&&l.feeder.length;i++){const face=l.feeder.shift();gainFood(l,face==='dual'?['invertebrate','seed']:[face]);}}
function utility(l){const egg=sum(l.entries.map(e=>e.eggs)),food=sum(FOOD.map(f=>Math.min(l.food[f],l.demand[f])));
 // One shadow price only: resource output is valued as displaced ordinary actions.
 const cash=Math.min(RATE.grassland[l.p.habitats.grassland.length],sum(l.entries.map(e=>BIRDS[e.id].eggs-e.eggs))+egg);
 return l.points+egg+cash*(food/RATE.forest[l.p.habitats.forest.length]+Math.min(l.cards,l.cardNeed)/RATE.wetland[l.p.habitats.wetland.length]);
}
// Only unconditional future draws can relax the deferred-discard reservation.
const futureCards=row=>sum(row.map(e=>BIRDS[e.id].powerType!=='brown'?0:({24:2,34:1,56:1,59:1}[BIRDS[e.id].powerCode]??0)));
function power(l,e,row,repeat=true,future=0){const b=BIRDS[e.id],c=b.powerCode;if(b.powerType!=='brown')return;
 if(c===33||c===41){const next=clone(l);if(!spendEgg(next,c===33?e.id:null))return;if(c===33)gainFood(next,FOOD,2);else next.cards+=2;if(utility(next)>utility(l))Object.assign(l,next);return;}
 if(c===43||c===49){if(!repeat)return;let best=l,bestV=utility(l);for(const t of row){const q=BIRDS[t.id];if(t.id===e.id||[43,49].includes(q.powerCode)||(c===49&&q.powerGroup!=='hunting/fishing'))continue;const n=clone(l);power(n,t,row,false,future);if(utility(n)>bestV){best=n;bestV=utility(n);}}if(best!==l)Object.assign(l,best);return;}
 if([4,27,32,35,62].includes(c)){if(!l.cards||(c!==4&&l.cards-1+future<(l.discard??0)))return;const n=clone(l);n.cards--;n.points++;if(c===4)n.cards++;if(c===27)lay(n,1,x=>x.id===e.id);if(c===32)gainFood(n,['fruit']);if(c===35)gainFood(n,['seed']);if(c===62)gainFood(n,['invertebrate','seed']);if(utility(n)>utility(l))Object.assign(l,n);return;}
 if([9,23,36].includes(c)){const f=c===23?'seed':'fish';if(l.food[f]){const n=clone(l);n.food[f]--;n.points+=2;if(utility(n)>utility(l))Object.assign(l,n);}return;}
 if([24,56,59].includes(c))l.cards+=c===24?2:1;
 if([21,34].includes(c)){l.cards+=c===34?2:1;l.discard=(l.discard??0)+1;}
 if(c===31)l.points++;
 const foods={25:'invertebrate',29:'fish',57:'fruit',60:'fish',63:'seed',66:'seed',16:'fruit',40:'invertebrate'};
 if(foods[c])gainFood(l,[foods[c]],c===29?3:1);
 if(c===14)lay(l,1);if(c===30)lay(l,1,x=>x.id===e.id);
 const nests={12:'cavity',26:'ground',52:'platform',65:'bowl'};if(nests[c])for(const t of l.entries)if([nests[c],'wild'].includes(BIRDS[t.id].nest))lay(l,1,x=>x.id===t.id);
}
/** Diagnostic export: no deck identities, random outcomes or opponent private data. */
export function studyRowTrace(state,player,h,activations=1){let joint=ledger(state,player),isolated=0,exceptional=0;
 for(let turn=0;turn<activations;turn++){base(joint,h);const start=clone(joint),v=utility(start),row=joint.p.habitats[h];
  const ordered=[...row].reverse();for(let i=0;i<ordered.length;i++){const e=ordered[i],one=clone(start);power(one,e,row);one.cards=Math.max(0,one.cards-(one.discard??0));one.discard=0;const delta=utility(one)-v;isolated+=delta;if([33,41,43,49].includes(BIRDS[e.id].powerCode))exceptional+=delta;power(joint,e,row,true,futureCards(ordered.slice(i+1)));}
  joint.cards=Math.max(0,joint.cards-(joint.discard??0));joint.discard=0;
 }
 const initial=ledger(state,player);for(let i=0;i<activations;i++)base(initial,h);
 return {gain:utility(joint)-utility(initial),interaction:utility(joint)-utility(initial)-isolated,exceptional,ledger:joint};
}
function components(state,player,T){const p=state.players[player],n=Math.min(2,Math.ceil(T/3)),food=sum(FOOD.map(f=>p.food[f])),available=p.hand.map(id=>BIRDS[id]).filter(b=>b.habitats.some(h=>p.habitats[h].length<5)),hand=available.length,slots=15-allBirds(p).length;
 const plays=Math.min(slots,hand,T/2.5),demand=Math.min(T*1.2,sum(available.map(b=>b.either?1:sum(Object.values(b.food)))),plays*3);
 let baseline=0;for(const e of allBirds(p)){const b=BIRDS[e.id];if(b.powerType==='brown'&&b.powerCode===33)baseline+=.65*.9*Math.min(1,Math.max(0,demand-food)/Math.max(1,T))*T/3;if(b.powerType==='brown'&&b.powerCode===41)baseline+=.65*.5*Math.min(1,slots/5)*Math.max(0,1-p.hand.length/10)*T/3;}
 const traces=HABITATS.map(h=>studyRowTrace(state,player,h,n));
 // One habitat schedule, not three incompatible schedules. Zero is the skip schedule.
 const best=traces.reduce((a,b)=>b.gain>a.gain?b:a,{gain:0,exceptional:0,interaction:0});
 return {exceptional:clip(best.exceptional-baseline),chains:clip(best.interaction)};
}
/** Same original-row atomic ledgers, with no investment plan computation. */
export function leanEsAdjustment(state,player){
 const T=remainingActions(state,player);if(!T)return 0;
 if(state.physical)state={...state,players:state.players.map((p,i)=>i===player?{...p,hand:p.hand.filter(id=>knownCard(state,id))}:p)};
 const {exceptional,chains}=components(state,player,T);
 return clip(.5*(exceptional+chains),6);
}
export function evaluateOvernightLeaf(state,player,method='reference'){
 if(method!=='lean-es')return evaluateStudyLeaf(state,player,method);
 return evaluateLeaf(state,player,'opening-plan')+leanEsAdjustment(state,player);
}
