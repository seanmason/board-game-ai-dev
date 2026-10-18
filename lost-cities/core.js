import {CARDS,ALL_IDS,COLORS,EDITION,cardType} from './catalog.js';
import {placements,drawChoices,actionKey} from './actions.js';
import {roundScore,score} from './scoring.js';
export {score};
export const clone=s=>structuredClone(s),currentPlayer=s=>s.current;
export function random(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const stacks=()=>Object.fromEntries(COLORS.map(c=>[c,[]]));
const flags=v=>Object.fromEntries(COLORS.map(c=>[c,v]));
export function newGame({players=2,mode='physical',edition=EDITION,seed=1,starter=0,profile='strict-booklet'}={}){
 if(players!==2||!['physical','digital'].includes(mode)||edition!==EDITION||![0,1].includes(starter)||profile!=='strict-booklet')throw Error('Unsupported original-five-expedition setup');
 const s={version:1,edition,profile,players,mode,seed:seed>>>0,round:0,starter,current:starter,scores:[0,0],roundScores:[],adjudications:[],winners:[]};deal(s);assertValid(s);return s;
}
export function deal(s){
 s.round++;s.turn=0;s.current=s.starter;s.expeditions=[stacks(),stacks()];s.discards=stacks();s.visibleTops=flags(null);s.discardDepthKnown=flags(true);s.discardSizes=flags(0);s.lastDiscard=null;s.pending=null;s.events=[];
 const deck=s.mode==='digital'?shuffle(ALL_IDS,random(s.seed+s.round*997)):Array(60).fill(null);s.hands=[Array.from({length:8},()=>deck.pop()),Array.from({length:8},()=>deck.pop())];s.deck=s.mode==='digital'?deck:null;s.unseenCount=s.mode==='physical'?44:0;s.deckCount=44;s.deckKnowledge={kind:'history',lower:44,upper:44};s.memories=Array.from({length:2},()=>({knownHands:[[],[]],discards:stacks()}));s.phase=s.mode==='physical'?'setup':'place';s.proposedStarter=null;
}
export function legalActions(s,actor=s.current){
 if(actor!==s.current)return [];
 if(s.phase==='place')return placements(s.hands[actor],s.expeditions[actor]);
 if(s.phase==='draw')return drawChoices(s.visibleTops,s.lastDiscard);
 if(s.phase==='choose-starter')return [{type:'chooseStarter',starter:0},{type:'chooseStarter',starter:1}];
 return [];
}
function removeKnown(s,p,id){const t=cardType(id);for(const m of s.memories){const i=m.knownHands[p].indexOf(t);if(i>=0)m.knownHands[p].splice(i,1);}}
export function takeFromHand(s,p,id){
 let i=s.hands[p].indexOf(id);if(i<0){i=s.hands[p].findIndex(c=>c&&cardType(c)===cardType(id));if(i>=0)id=s.hands[p][i];}
 if(i<0){i=s.hands[p].indexOf(null);if(i<0)throw Error('That card is not held');const used=new Set(allCards(s).filter(Boolean));if(used.has(id)){id=ALL_IDS.find(c=>cardType(c)===cardType(id)&&!used.has(c));if(!id)throw Error('Card already recorded elsewhere');}}
 s.hands[p].splice(i,1);removeKnown(s,p,id);return id;
}
export function placeCard(s,a){
 const id=takeFromHand(s,s.current,a.cardId),c=CARDS[id];
 if(a.type==='play')s.expeditions[s.current][c.color].push(id);
 else{s.discards[c.color].push(id);s.visibleTops[c.color]=id;s.discardSizes[c.color]=s.discardDepthKnown[c.color]?s.discards[c.color].length:null;for(const m of s.memories)m.discards[c.color].push(id);s.lastDiscard=id;}
 s.events.push({type:a.type,actor:s.current,cardId:id});s.phase='draw';
}
export function drawCard(s,a,{cardId=null,lastCard,newTop}={}){
 let id;
 if(a.source==='deck'){
  if(s.mode==='digital'){id=s.deck.pop();s.deckCount=s.deck.length;}else{
   if(s.unseenCount<1)throw Error('No unlocated card remains');s.unseenCount--;id=cardId;
   if(id&&allCards(s).includes(id))throw Error('Drawn card is already recorded');
   if(s.deckCount!==null){s.deckCount--;if(lastCard!==undefined&&lastCard!==(s.deckCount===0))throw Error('Last-card report contradicts recorded deck count');}
   else{if(typeof lastCard!=='boolean')throw Error('Report whether this was the last actual draw-pile card');if(lastCard)s.deckCount=0;}
  }
  if(s.deckCount===0)s.deckKnowledge={kind:'history',lower:0,upper:0};else if(s.deckCount!==null)s.deckKnowledge={kind:'history',lower:s.deckCount,upper:s.deckCount};else s.deckKnowledge={kind:'unknown',lower:1,upper:Math.min(s.unseenCount,Math.max(0,s.deckKnowledge.upper-1))};
 }else{
  const c=a.source;id=s.discards[c].pop();
  if(!id)throw Error('Unknown discard top must be reconciled');
  for(const m of s.memories){m.discards[c].pop();m.knownHands[s.current].push(cardType(id));}
  if(s.mode==='physical'){
   if(s.discards[c].length&&s.discards[c].at(-1)===null){if(!CARDS[newTop]||CARDS[newTop].color!==c)throw Error('Enter the newly exposed discard top');s.discards[c][s.discards[c].length-1]=newTop;}
   else if(!s.discards[c].length&&!s.discardDepthKnown[c]){
    if(newTop===undefined)throw Error('Report the newly exposed top or that the pile is empty');
    if(newTop===null)s.discardDepthKnown[c]=true;else{if(!CARDS[newTop]||CARDS[newTop].color!==c||s.unseenCount<1)throw Error('Invalid newly exposed discard');s.discards[c].push(newTop);s.unseenCount--;}
   }
  }
  s.visibleTops[c]=s.discards[c].at(-1)??null;s.discardSizes[c]=s.discardDepthKnown[c]?s.discards[c].length:null;
  for(const m of s.memories){if(m.discards[c].length<s.discards[c].length)m.discards[c].unshift(...Array(s.discards[c].length-m.discards[c].length).fill(null));if(m.discards[c].length)m.discards[c][m.discards[c].length-1]=s.visibleTops[c];}
  if(s.mode==='physical'&&s.deckCount===null)s.deckKnowledge.upper=Math.min(s.deckKnowledge.upper,s.unseenCount);
 }
 s.hands[s.current].push(id);s.events.push({type:'draw',actor:s.current,source:a.source,...(a.source==='deck'?{}:{cardId:id})});s.pending=null;s.lastDiscard=null;s.turn++;
 if(s.deckCount===0){endRound(s);return;}
 s.current=1-s.current;s.phase='place';
}
export function endRound(s){
 const parts=roundScore(s);s.roundScores.push(parts);for(let p=0;p<2;p++)s.scores[p]+=parts[p].total;
 if(s.round===3){const best=Math.max(...s.scores);s.winners=s.scores.flatMap((v,p)=>v===best?[p]:[]);s.phase='gameover';}
 else{s.proposedStarter=parts[0].total===parts[1].total?null:parts[0].total>parts[1].total?0:1;s.phase='choose-starter';}
}
export function chooseStarter(s,a){if(s.phase!=='choose-starter'||![0,1].includes(a.starter))throw Error('Choose an agreed next-round starter');s.adjudications.push({round:s.round,nextStarter:a.starter,basis:a.basis??'agreed',proposedReading:'last-round higher score',proposedStarter:s.proposedStarter});s.starter=a.starter;deal(s);}
export function applyAction(state,a){
 if(state.mode!=='digital')throw Error('Record the actual physical table');assertValid(state);const s=clone(state);
 if(a.type==='chooseStarter')chooseStarter(s,a);
 else{if(!legalActions(s).some(b=>actionKey(a)===actionKey(b)))throw Error('Illegal Lost Cities action');if(a.type==='draw')drawCard(s,a,{});else placeCard(s,a);}
 assertValid(s);return s;
}
export function allCards(s){return [...(s.mode==='digital'?s.deck:Array(s.unseenCount).fill(null)),...s.hands.flat(),...s.expeditions.flatMap(p=>COLORS.flatMap(c=>p[c])),...COLORS.flatMap(c=>s.discards[c])];}
export const outcome=s=>s.phase==='gameover'?s.scores.map((_,p)=>s.winners.includes(p)?1/s.winners.length:0):null;
export function assertValid(s){
 const fail=()=>{throw Error('Invalid Lost Cities position');};
 if(!s||s.version!==1||s.edition!==EDITION||s.profile!=='strict-booklet'||s.players!==2||!['physical','digital'].includes(s.mode)||!['setup','place','draw','pending-observation','choose-starter','gameover'].includes(s.phase)||!Number.isInteger(s.round)||s.round<1||s.round>3||![0,1].includes(s.current)||![0,1].includes(s.starter)||!Number.isInteger(s.turn)||s.turn<0)fail();
 if(![null,0,1].includes(s.proposedStarter)||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295)fail();
 for(const f of ['hands','expeditions','scores','memories'])if(!Array.isArray(s[f])||s[f].length!==2)fail();
 if(!Array.isArray(s.events)||!Array.isArray(s.roundScores)||!Array.isArray(s.adjudications)||!Array.isArray(s.winners)||!s.deckKnowledge||!Number.isInteger(s.deckKnowledge.lower)||!Number.isInteger(s.deckKnowledge.upper)||s.deckKnowledge.lower<0||s.deckKnowledge.upper<s.deckKnowledge.lower||s.deckKnowledge.upper>44)fail();
 if(s.deckCount!==null&&(!Number.isInteger(s.deckCount)||s.deckCount<0||s.deckCount>44||s.deckKnowledge.lower!==s.deckCount||s.deckKnowledge.upper!==s.deckCount))fail();
 if(s.mode==='digital'&&(!Array.isArray(s.deck)||s.deckCount!==s.deck.length||s.unseenCount!==0))fail();
 if(s.mode==='physical'&&(s.deck!==null||!Number.isInteger(s.unseenCount)||s.unseenCount<0||s.unseenCount>60||s.deckKnowledge.upper>s.unseenCount))fail();
 if(s.mode==='physical'&&COLORS.every(c=>s.discardDepthKnown[c])&&s.deckCount!==null&&s.deckCount!==s.unseenCount)fail();
 for(let p=0;p<2;p++){
  if(!Array.isArray(s.hands[p])||s.hands[p].length!==((s.phase==='draw'||s.phase==='pending-observation')&&p===s.current?7:8)||!Number.isInteger(s.scores[p]))fail();
  for(const c of COLORS){const column=s.expeditions[p]?.[c];if(!Array.isArray(column))fail();let last=0;for(const id of column){const card=CARDS[id];if(!card||card.color!==c||(card.value===0?last>0:card.value<=last))fail();last=card.value;}}
  const m=s.memories[p];if(!m||!Array.isArray(m.knownHands)||m.knownHands.length!==2||m.knownHands.some(h=>!Array.isArray(h)||h.some(t=>!ALL_IDS.some(id=>cardType(id)===t)))||!m.discards)fail();
 }
 for(const c of COLORS){const pile=s.discards?.[c];if(!Array.isArray(pile)||typeof s.discardDepthKnown?.[c]!=='boolean'||(!s.discardDepthKnown[c]&&!pile.length)||pile.some(id=>id!==null&&(!CARDS[id]||CARDS[id].color!==c))||(pile.length&&pile.at(-1)===null)||s.visibleTops?.[c]!==(pile.at(-1)??null)||s.discardSizes?.[c]!== (s.discardDepthKnown[c]?pile.length:null))fail();
  for(const m of s.memories){const a=m.discards[c];if(!Array.isArray(a)||a.length!==pile.length||a.some((id,i)=>id!==null&&id!==pile[i])||(a.at(-1)??null)!==s.visibleTops[c])fail();}
 }
 const cards=allCards(s),known=cards.filter(Boolean);if(cards.length!==60||known.some(id=>!CARDS[id])||new Set(known).size!==known.length||(s.mode==='digital'&&known.length!==60))fail();
 for(const m of s.memories)for(let p=0;p<2;p++){const required=m.knownHands[p],unknown=s.hands[p].filter(id=>id===null).length,have=s.hands[p].filter(Boolean).map(cardType);let missing=0;for(const t of new Set(required)){const need=required.filter(x=>x===t).length,held=have.filter(x=>x===t).length;missing+=Math.max(0,need-held);}if(required.length>s.hands[p].length||missing>unknown)fail();}
 const residual={};for(const id of ALL_IDS)residual[cardType(id)]=(residual[cardType(id)]??0)+1;for(const id of known)residual[cardType(id)]--;
 for(const m of s.memories){const required={};for(let p=0;p<2;p++)for(const t of new Set(m.knownHands[p])){const need=m.knownHands[p].filter(x=>x===t).length,held=s.hands[p].filter(id=>id&&cardType(id)===t).length;required[t]=(required[t]??0)+Math.max(0,need-held);}if(Object.entries(required).some(([t,n])=>n>(residual[t]??0)))fail();}
 if(s.mode==='physical'){const capacity=ALL_IDS.filter(id=>!s.discardDepthKnown[CARDS[id].color]&&!known.includes(id)).length;if(s.deckKnowledge.upper<Math.max(0,s.unseenCount-capacity))fail();}
 if((s.phase==='pending-observation')!==!!s.pending)fail();if(s.pending&&!drawChoices(s.visibleTops,s.lastDiscard).some(a=>a.source===s.pending.source))fail();
 if(s.lastDiscard&&(!CARDS[s.lastDiscard]||s.visibleTops[CARDS[s.lastDiscard].color]!==s.lastDiscard||!['draw','pending-observation'].includes(s.phase)))fail();
 if((s.deckCount===0)!==['choose-starter','gameover'].includes(s.phase))fail();if(s.phase==='gameover'&&s.round!==3)fail();if(s.phase==='choose-starter'&&s.round===3)fail();
 if(s.phase==='setup'&&(s.mode!=='physical'||s.turn!==0))fail();
 const ended=['choose-starter','gameover'].includes(s.phase);if(s.roundScores.length!==(ended?s.round:s.round-1))fail();const totals=[0,0];for(const round of s.roundScores){if(!Array.isArray(round)||round.length!==2)fail();for(let p=0;p<2;p++){const r=round[p];if(!Number.isInteger(r?.total)||(!r.manual&&(!r.parts||COLORS.some(c=>!Number.isInteger(r.parts[c]?.total))||r.total!==COLORS.reduce((n,c)=>n+r.parts[c].total,0))))fail();totals[p]+=r.total;}}
 if(JSON.stringify(totals)!==JSON.stringify(s.scores))fail();if(ended&&JSON.stringify(s.roundScores.at(-1))!==JSON.stringify(roundScore(s)))fail();
 if(s.phase==='gameover'){const best=Math.max(...s.scores);if(JSON.stringify(s.winners)!==JSON.stringify(s.scores.flatMap((v,p)=>v===best?[p]:[])))fail();}else if(s.winners.length)fail();return true;
}
