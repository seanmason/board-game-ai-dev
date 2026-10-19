import {BIRDS,BONUSES,GOAL_TILES} from '../../wingspan/catalog.js';
import {FOOD,HABITATS,goalQuantity,bonusPoints} from '../../wingspan/scoring.js';

export const FEATURE_VERSION='wingspan-compact-v1';
const TEMPO=['round','phase.setup','phase.play','phase.power','phase.gameover','viewerToAct','viewerIsCurrent','viewerIsStarter','competitiveGoals','ownRemaining','otherRemaining','publicKnown','ownHandKnown','ownBonusKnown','ownOfferKnown','supported'];
const RESOURCES=[...FOOD.map(f=>'food.'+f),'handCount','bonusCount','eggs','eggCapacity','cached','tucked','goalPoints'];
const ROW=['occupancy','points','baseOutput','foodOutput','cardOutput','eggOutput','tuckOutput','cacheOutput','eggCost','cardCost','foodCost','repeat','pink','producerBeforeConsumer','consumerBeforeProducer','freeOutput'];
const HAND=['knownCount','unknownCount','affordable','placeable','pointsSum','pointsMax','capacitySum','costSum',...HABITATS.map(h=>'habitat.'+h),...HABITATS.map(h=>'affordable.'+h),'foodOutput','cardOutput','eggOutput','tuckOutput','repeat','eggCost','cardCost','foodCost','engineSynergy','bonusMatches'];
const names=[...TEMPO];
for(const s of ['own','other'])for(const k of RESOURCES)names.push(`${s}.${k}`);
for(const s of ['own','other'])for(const h of HABITATS)for(const k of ROW)names.push(`${s}.${h}.${k}`);
names.push(...HAND.map(k=>'hand.'+k));
for(let r=0;r<4;r++)for(const k of ['known','ownQuantity','otherQuantity'])names.push(`goal.${r}.${k}`);
names.push('bonus.knownCount','bonus.unknownCount','bonus.points','bonus.handMatches');
names.push(...[...FOOD,'dual','unknown'].map(f=>'feeder.'+f),'feeder.known');
names.push(...['knownCount','unknownCount','affordable','pointsMax','foodOutput','cardOutput','eggOutput','bonusMatches'].map(k=>'tray.'+k));
export const FEATURE_NAMES=Object.freeze(names);
const check=(ok,msg)=>{if(!ok)throw Error('Invalid redacted Wingspan observation: '+msg);};
const sum=a=>a.reduce((n,x)=>n+x,0);
const entries=p=>HABITATS.flatMap(h=>p.habitats[h]);
const integer=(n,label)=>check(Number.isInteger(n)&&n>=0&&n<=10000,label);
function validate(o,viewer){
 check(o&&o.version===1&&o.players?.length===2&&[0,1].includes(viewer),'two-player viewer/version');
 for(const key of ['deck','bonusDeck','bonusDiscard','rngState','seed','outcome','scores','physical','pendingObservation','valueExamples','teacherDecisions','targetMargin','targetAux'])check(!(key in o),'forbidden '+key);
 check(['setup','play','power','gameover'].includes(o.phase)&&Number.isInteger(o.round)&&o.round>=1&&o.round<=4,'phase/round');
 check([0,1].includes(o.currentPlayer)&&[0,1].includes(o.starter),'turn seats');
 for(const k of ['deckCount','bonusDeckCount','birdDiscardCount','bonusDiscardCount','eggSupply'])integer(o[k],k);
 check(Array.isArray(o.remaining)&&o.remaining.length===2,'remaining');o.remaining.forEach(n=>integer(n,'remaining'));
 check(Array.isArray(o.pending),'pending');
 for(const [i,p]of o.players.entries()){
  for(const k of ['hand','bonuses','bonusOffer'])check(Array.isArray(p[k]),k);
  check(p.hand.every(id=>Number.isInteger(id)&&BIRDS[id])&&p.bonuses.every(id=>Number.isInteger(id)&&BONUSES[id])&&p.bonusOffer.every(id=>Number.isInteger(id)&&BONUSES[id]),'private IDs');
  for(const [count,k]of [['handCount','hand'],['privateBonusCount','bonuses'],['bonusOfferCount','bonusOffer']]){integer(p[count],count);check(p[count]>=p[k].length,'known masks');}
  if(i!==viewer)check(!p.hand.length&&!p.bonuses.length&&!p.bonusOffer.length,'opponent private identities');
  for(const f of FOOD)integer(p.food?.[f],'food');
  check(Array.isArray(p.goalPoints)&&p.goalPoints.length<=4&&p.goalPoints.every(n=>Number.isFinite(n)&&n>=0),'goalPoints');
  for(const h of HABITATS){check(Array.isArray(p.habitats?.[h])&&p.habitats[h].length<=5,'row');for(const e of p.habitats[h]){
   check(Number.isInteger(e.id)&&BIRDS[e.id]?.habitats.includes(h),'public bird');integer(e.eggs,'eggs');
   check(Array.isArray(e.cached)&&e.cached.every(f=>FOOD.includes(f)),'cache');
   check(Array.isArray(e.tucked)&&e.tucked.every(x=>x===null)&&e.tuckedCount===e.tucked.length,'tucked identities/mask');
  }}
 }
 for(const e of o.pending)if(e.owner!==viewer)check(!e.event?.cards?.length,'opponent pending identities');
 check(Array.isArray(o.tray)&&o.tray.length<=3&&o.tray.every(id=>id===null||(Number.isInteger(id)&&BIRDS[id])),'tray');
 check(Array.isArray(o.feeder)&&o.feeder.length<=5&&o.feeder.every(f=>f===null||[...FOOD,'dual'].includes(f)),'feeder');
 check(Array.isArray(o.goals)&&o.goals.length===4&&o.goals.every(g=>g===null||(Number.isInteger(g.tile)&&GOAL_TILES[g.tile]?.[g.side])),'goals');
 check(Array.isArray(o.birdDiscard)&&o.birdDiscard.every(id=>Number.isInteger(id)&&BIRDS[id]),'discard');
}
function supported(o,v){const p=o.players[v];return o.mode!=='physical'&&o.phase==='play'&&!o.pending.length&&!o.turnContext&&o.publicComplete!==false&&o.tray.every(x=>x!==null)&&o.feeder.every(x=>x!==null)&&o.goals.every(Boolean)&&p.hand.length===p.handCount&&p.bonuses.length===p.privateBonusCount&&p.bonusOffer.length===p.bonusOfferCount;}
export function supportedModelObservation(o,v){try{validate(o,v);return supported(o,v);}catch{return false;}}

// Semantic nominal yields/costs, not probabilities or a power-code histogram.
// Pink triggers and white powers are separated from repeatable brown engines.
function power(b){
 const c=b.powerCode,has=a=>a.includes(c),x={food:0,card:0,egg:0,tuck:0,cache:0,eggCost:0,cardCost:0,foodCost:0,repeat:0};
 if(has([1,11,15,16,19,22,25,39,40,45,48,53,57,58,60,63,64,66]))x.food=1;
 if(has([5,33])){x.food=c===33?2:1;x.eggCost=1;}
 if(has([6,29]))x.food=3;
 if(has([3,8,21,56,59]))x.card=1;
 if(has([24,34,41]))x.card=2;
 if(has([21,34]))x.cardCost=1;
 if(c===41)x.eggCost=1;
 if(has([2,12,14,18,26,28,30,52,54,61,65,67]))x.egg=1;
 if(has([4,27,32,35,50,62])){x.tuck=1;x.cardCost=1;}
 if(c===4)x.card=1;
 if(c===27)x.egg=1;
 if(has([32,35,62]))x.food=1;
 if(has([9,23,36])){x.tuck=2;x.foodCost=1;}
 if(has([17,42,46]))x.tuck=1;
 if(has([1,7,10,31,55]))x.cache=1;
 if(has([43,49]))x.repeat=1;
 return x;
}
function affordable(p,b){
 const total=sum(FOOD.map(f=>p.food[f]));
 if(b.either)return (b.food.wild>0&&total>=1)||FOOD.some(f=>b.food[f]>0&&p.food[f]>0)||total>=2;
 const deficit=sum(FOOD.map(f=>Math.max(0,b.food[f]-p.food[f]))),used=sum(FOOD.map(f=>Math.min(b.food[f],p.food[f])));
 return total-used>=2*deficit+b.food.wild;
}
const cost=b=>b.either?1:sum(Object.values(b.food));
const eggCost=[0,1,1,2,2];
const rowBase={forest:[1,1,2,2,3,3],grassland:[2,2,3,3,4,4],wetland:[1,1,2,2,3,3]};
function rowFeatures(row,h){
 const powers=row.map(e=>BIRDS[e.id].powerType==='brown'?power(BIRDS[e.id]):power({powerCode:0}));
 let before=0,after=0;
 // Activation runs right to left. Match resource type; no outcome simulation.
 for(let i=0;i<powers.length;i++)for(let j=0;j<powers.length;j++)if(i!==j){const a=powers[i],b=powers[j];const links=a.egg*b.eggCost+a.card*b.cardCost+a.food*b.foodCost;if(i>j)before+=links;else after+=links;}
 const total=k=>sum(powers.map(p=>p[k]));
 return [row.length/5,sum(row.map(e=>BIRDS[e.id].points))/50,rowBase[h][row.length]/4,...['food','card','egg','tuck','cache','eggCost','cardCost','foodCost','repeat'].map(k=>total(k)/10),row.filter(e=>BIRDS[e.id].powerType==='pink').length/5,before/25,after/25,sum(powers.map(p=>p.eggCost+p.cardCost+p.foodCost===0?p.food+p.card+p.egg+p.tuck+p.cache:0))/10];
}
function handFeatures(ids,p,unknown){
 const birds=ids.map(id=>BIRDS[id]),eggs=sum(entries(p).map(e=>e.eggs)),all=entries(p).map(e=>power(BIRDS[e.id]));
 const aff=b=>affordable(p,b),place=b=>aff(b)&&b.habitats.some(h=>p.habitats[h].length<5&&eggs>=eggCost[p.habitats[h].length]);
 const ps=birds.map(power),total=k=>sum(ps.map(q=>q[k]));
 const matches=b=>sum(p.bonuses.map(id=>Number(b.bonuses.includes(BONUSES[id].key))));
 return [birds.length/20,unknown/20,birds.filter(aff).length/20,birds.filter(place).length/20,sum(birds.map(b=>b.points))/200,Math.max(0,...birds.map(b=>b.points))/10,sum(birds.map(b=>b.eggs))/120,sum(birds.map(cost))/60,...HABITATS.map(h=>birds.filter(b=>b.habitats.includes(h)).length/20),...HABITATS.map(h=>birds.filter(b=>aff(b)&&b.habitats.includes(h)&&p.habitats[h].length<5&&eggs>=eggCost[p.habitats[h].length]).length/20),...['food','card','egg','tuck','repeat','eggCost','cardCost','foodCost'].map(k=>total(k)/40),sum(ps.map(q=>sum(all.map(a=>q.eggCost*a.egg+q.cardCost*a.card+q.foodCost*a.food+q.egg*a.eggCost+q.card*a.cardCost+q.food*a.foodCost))))/100,sum(birds.map(matches))/100];
}
/** Separately redacted observations only. All known hand/bonus cards contribute.
 * Fixed unit scales precede training-only normalization. Summaries intentionally
 * alias species, precise food choices, nest-dependent yields, and repeat targets.
 * Public unknowns and incomplete own private knowledge are masked and unsupported.
 */
export function encodeObservation(o,viewer){
 validate(o,viewer);const p=o.players[viewer],q=o.players[1-viewer],actor=o.phase==='power'?(o.pending[0]?.owner??o.currentPlayer):o.currentPlayer;
 const x=[o.round/4,...['setup','play','power','gameover'].map(k=>Number(o.phase===k)),Number(actor===viewer),Number(o.currentPlayer===viewer),Number(o.starter===viewer),Number(o.goalMode==='green'),o.remaining[viewer]/8,o.remaining[1-viewer]/8,Number(o.publicComplete!==false&&o.goals.every(Boolean)&&o.feeder.every(f=>f!==null)&&o.tray.every(id=>id!==null)),Number(p.hand.length===p.handCount),Number(p.bonuses.length===p.privateBonusCount),Number(p.bonusOffer.length===p.bonusOfferCount),Number(supported(o,viewer))];
 for(const a of [p,q]){const es=entries(a);x.push(...FOOD.map(f=>a.food[f]/20),a.handCount/20,a.privateBonusCount/5,sum(es.map(e=>e.eggs))/75,sum(es.map(e=>BIRDS[e.id].eggs))/75,sum(es.map(e=>e.cached.length))/75,sum(es.map(e=>e.tuckedCount))/75,sum(a.goalPoints)/28);}
 for(const a of [p,q])for(const h of HABITATS)x.push(...rowFeatures(a.habitats[h],h));
 x.push(...handFeatures(p.hand,p,p.handCount-p.hand.length));
 for(const g of o.goals)x.push(Number(!!g),g?goalQuantity(p,GOAL_TILES[g.tile][g.side])/30:0,g?goalQuantity(q,GOAL_TILES[g.tile][g.side])/30:0);
 const bonusMatches=ids=>sum(ids.map(id=>sum(p.bonuses.map(b=>Number(BIRDS[id].bonuses.includes(BONUSES[b].key))))));
 x.push(p.bonuses.length/5,(p.privateBonusCount-p.bonuses.length)/5,sum(p.bonuses.map(id=>bonusPoints(id,{...p,hand:Array(p.handCount).fill(null)})))/50,bonusMatches(p.hand)/100);
 for(const face of [...FOOD,'dual',null])x.push(o.feeder.filter(f=>f===face).length/5);
 x.push(Number(o.feeder.every(f=>f!==null)));
 const tray=o.tray.filter(id=>id!==null),tb=tray.map(id=>BIRDS[id]);
 x.push(tray.length/3,o.tray.filter(id=>id===null).length/3,tb.filter(b=>affordable(p,b)).length/3,Math.max(0,...tb.map(b=>b.points))/10,...['food','card','egg'].map(k=>sum(tb.map(b=>power(b)[k]))/6),bonusMatches(tray)/15);
 check(x.length===192&&x.length===FEATURE_NAMES.length&&x.every(Number.isFinite),'feature dimensions/finite');return x;
}
