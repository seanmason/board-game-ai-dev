import {BIRDS,BONUSES} from '../../wingspan/catalog.js';
import {FOOD,HABITATS} from '../../wingspan/scoring.js';
export const FEATURE_VERSION='wingspan-observation-v1';
const TYPES=['none','white','brown','pink'],NESTS=['ground','bowl','platform','cavity','wild'];
const TRAITS=['known','points','capacity','wingspan','either','foodTotal','powerCode',...TYPES.map(x=>'type.'+x),...NESTS.map(x=>'nest.'+x),...[...FOOD,'wild'].map(x=>'cost.'+x)];
const SLOTS=[...TRAITS,'eggs','cached','tucked'];
const names=['round','phase.setup','phase.play','phase.power','phase.gameover','viewerToAct','viewerIsCurrent','viewerIsStarter','competitiveGoals','eggSupply','deckCount','bonusDeckCount','birdDiscardCount','bonusDiscardCount','publicComplete'];
for(const side of ['own','other']){
 for(const key of ['remaining','handCount','knownHandCount','unknownHandCount','bonusCount','knownBonusCount','bonusOfferCount','knownOfferCount','setupDone',...FOOD.map(f=>'food.'+f),...Array.from({length:4},(_,i)=>'goalPoints.'+i)])names.push(side+'.'+key);
 for(const h of HABITATS)for(let i=0;i<5;i++)for(const key of SLOTS)names.push(`${side}.${h}.${i}.${key}`);
 for(let code=0;code<=67;code++)names.push(`${side}.powerCount.${code}`);
}
for(let id=0;id<BIRDS.length;id++)names.push('own.hand.'+id);
for(const zone of ['bonuses','bonusOffer'])for(let id=0;id<BONUSES.length;id++)names.push('own.'+zone+'.'+id);
for(let i=0;i<3;i++)for(const key of TRAITS)names.push(`tray.${i}.${key}`);
for(const face of [...FOOD,'dual','unknown'])names.push('feeder.'+face);
for(let i=0;i<4;i++)for(const key of ['known','tile','side'])names.push(`goal.${i}.${key}`);
for(const key of ['knownCount','unknownCount','points','capacity',...Array.from({length:68},(_,i)=>'power.'+i)])names.push('discard.'+key);
export const FEATURE_NAMES=Object.freeze(names);
const check=(ok,msg)=>{if(!ok)throw Error('Invalid redacted Wingspan observation: '+msg);};
const count=(x,label)=>{check(Number.isFinite(x)&&x>=0,label);return x;};
function validate(o,viewer){
 check(o&&o.version===1&&o.players?.length===2&&[0,1].includes(viewer),'two-player viewer/version');
 for(const key of ['deck','bonusDeck','bonusDiscard','rngState','physical','pendingObservation','valueExamples','teacherDecisions','targetMargin','targetAux'])check(!(key in o),'forbidden '+key);
 check(['setup','play','power','gameover'].includes(o.phase)&&o.round>=1&&o.round<=4,'phase/round');
 check([0,1].includes(o.currentPlayer)&&[0,1].includes(o.starter),'turn seats');
 for(const key of ['deckCount','bonusDeckCount','birdDiscardCount','bonusDiscardCount','eggSupply'])count(o[key],key);
 check(Array.isArray(o.remaining)&&o.remaining.length===2&&o.remaining.every(n=>Number.isInteger(n)&&n>=0),'remaining');
 check(Array.isArray(o.pending),'pending');
 for(const [i,p]of o.players.entries()){
  for(const key of ['hand','bonuses','bonusOffer'])check(Array.isArray(p[key]),key);
  check(p.hand.every(id=>Number.isInteger(id)&&BIRDS[id])&&p.bonuses.every(id=>Number.isInteger(id)&&BONUSES[id])&&p.bonusOffer.every(id=>Number.isInteger(id)&&BONUSES[id]),'known private IDs');
  check(count(p.handCount,'handCount')>=p.hand.length&&count(p.privateBonusCount,'privateBonusCount')>=p.bonuses.length&&count(p.bonusOfferCount,'bonusOfferCount')>=p.bonusOffer.length,'known masks');
  if(i!==viewer)check(!p.hand.length&&!p.bonuses.length&&!p.bonusOffer.length,'opponent private identities');
  for(const f of FOOD)count(p.food?.[f],'food');
  check(Array.isArray(p.goalPoints)&&p.goalPoints.every(Number.isFinite),'goalPoints');
  for(const h of HABITATS){check(Array.isArray(p.habitats?.[h])&&p.habitats[h].length<=5,'row');for(const e of p.habitats[h]){
   check(Number.isInteger(e.id)&&BIRDS[e.id]&&BIRDS[e.id].habitats.includes(h),'public bird');count(e.eggs,'eggs');
   check(Array.isArray(e.cached)&&e.cached.every(f=>FOOD.includes(f)),'cache');
   check(Array.isArray(e.tucked)&&e.tucked.every(x=>x===null)&&e.tuckedCount===e.tucked.length,'tucked identities/mask');
  }}
 }
 for(const e of o.pending)if(e.owner!==viewer)check(!e.event?.cards?.length,'opponent pending identities');
 check(Array.isArray(o.tray)&&o.tray.length<=3&&o.tray.every(id=>id===null||(Number.isInteger(id)&&BIRDS[id])),'tray');
 check(Array.isArray(o.feeder)&&o.feeder.every(f=>f===null||[...FOOD,'dual'].includes(f)),'feeder');
 check(Array.isArray(o.goals)&&o.goals.length===4,'goals');
 check(Array.isArray(o.birdDiscard)&&o.birdDiscard.every(id=>Number.isInteger(id)&&BIRDS[id]),'public discard');
}
function traits(id){const b=Number.isInteger(id)?BIRDS[id]:null;if(!b)return Array(TRAITS.length).fill(0);return [1,b.points/10,b.eggs/6,b.wingspan/250,Number(b.either),Object.values(b.food).reduce((n,x)=>n+x,0)/3,b.powerCode/67,...TYPES.map(x=>Number(b.powerType===x)),...NESTS.map(x=>Number(b.nest===x)),...[...FOOD,'wild'].map(f=>b.food[f]/3)];}
/** Input must be a separately redacted publicObservation(state,viewer).
 * Fixed physical-unit scaling only; learned normalization fits TRAIN data.
 */
export function encodeObservation(o,viewer){
 validate(o,viewer);const actor=o.phase==='power'?(o.pending[0]?.owner??o.currentPlayer):o.currentPlayer;
 const x=[o.round/4,...['setup','play','power','gameover'].map(p=>Number(o.phase===p)),Number(actor===viewer),Number(o.currentPlayer===viewer),Number(o.starter===viewer),Number(o.goalMode==='green'),o.eggSupply/75,o.deckCount/170,o.bonusDeckCount/26,o.birdDiscardCount/170,o.bonusDiscardCount/26,Number(o.publicComplete!==false)];
 for(const i of [viewer,1-viewer]){const p=o.players[i],own=i===viewer;
  x.push(o.remaining[i]/8,p.handCount/20,p.hand.length/20,(p.handCount-p.hand.length)/20,p.privateBonusCount/5,p.bonuses.length/5,p.bonusOfferCount/5,p.bonusOffer.length/5,Number(p.setupDone),...FOOD.map(f=>p.food[f]/20),...Array.from({length:4},(_,r)=>(p.goalPoints[r]??0)/10));
  const codes=Array(68).fill(0);
  for(const h of HABITATS)for(let j=0;j<5;j++){const e=p.habitats[h][j];x.push(...traits(e?.id),e?e.eggs/6:0,e?e.cached.length/20:0,e?e.tuckedCount/20:0);if(e)codes[BIRDS[e.id].powerCode]++;}
  x.push(...codes.map(n=>n/15));
 }
 const p=o.players[viewer];for(let id=0;id<BIRDS.length;id++)x.push(Number(p.hand.includes(id)));
 for(const zone of ['bonuses','bonusOffer'])for(let id=0;id<BONUSES.length;id++)x.push(Number(p[zone].includes(id)));
 for(let i=0;i<3;i++)x.push(...traits(o.tray[i]));
 for(const f of [...FOOD,'dual',null])x.push(o.feeder.filter(t=>t===f).length/5);
 for(const g of o.goals)x.push(Number(!!g),g?(g.tile+1)/8:0,g?g.side:0);
 const disc=o.birdDiscard.map(id=>BIRDS[id]),codes=Array(68).fill(0);for(const b of disc)codes[b.powerCode]++;
 x.push(disc.length/170,(o.birdDiscardCount-disc.length)/170,disc.reduce((n,b)=>n+b.points,0)/1700,disc.reduce((n,b)=>n+b.eggs,0)/1020,...codes.map(n=>n/170));
 check(x.length===FEATURE_NAMES.length&&x.every(Number.isFinite),'feature dimensions/finite');return x;
}
