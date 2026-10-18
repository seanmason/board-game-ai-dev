import {EDITION,CARDS,ALL_IDS,TYPES,handSize,typeOf} from './catalog.js';
import {choices,choiceKey} from './actions.js';
import {roundScore,puddingScore,winnersFor} from './scoring.js';
export const clone=s=>structuredClone(s);
export function random(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const decisionOwners=s=>['choose','allCommitted','awaitHands'].includes(s.phase)?Array.from({length:s.players},(_,p)=>p).filter(p=>!s.commitments[p]):[];
export const currentPlayer=s=>decisionOwners(s)[0]??0;
export function newGame({players=2,mode='physical',edition=EDITION,seed=1}={}){
 if(![2,3,4,5].includes(players)||!['physical','digital'].includes(mode)||edition!==EDITION)throw Error('Unsupported Sushi Go setup');
 const s={version:1,edition,players,mode,seed:seed>>>0,round:0,pick:1,deck:mode==='digital'?shuffle(ALL_IDS,random(seed)):Array(108).fill(null),discard:[],tableaux:Array.from({length:players},()=>[]),puddings:Array.from({length:players},()=>[]),scores:Array(players).fill(0),roundScores:[],winners:[],events:[],memories:Array.from({length:players},()=>({}))};deal(s);assertValid(s);return s;
}
export const multiset=types=>types.reduce((a,t)=>(a[t]=(a[t]??0)+1,a),{});
export function rememberHand(s,viewer){const hand=s.hands[viewer].map(typeOf);if(hand.includes(null))return;s.memories[viewer][s.packets[viewer]]={types:multiset(hand),size:hand.length,pick:s.pick,provenance:'Observed actual received packet'};}
function deal(s){
 s.round++;s.pick=1;s.remaining=handSize(s.players);s.hands=Array.from({length:s.players},()=>Array.from({length:s.remaining},()=>s.deck.pop()));s.deckCount=s.deck.length;s.packets=Array.from({length:s.players},(_,p)=>`${s.round}:${p}`);s.commitments=Array(s.players).fill(null);s.pendingHands=Array(s.players).fill(s.mode==='physical');s.memories=Array.from({length:s.players},()=>({}));s.phase=s.mode==='physical'?'setup':'choose';
 if(s.mode==='digital')for(let p=0;p<s.players;p++)rememberHand(s,p);
}
export function legalActions(s,actor=currentPlayer(s)){
 if(!Number.isInteger(actor)||actor<0||actor>=s.players)return [];
 if(s.phase==='roundEnd')return [{type:'nextRound'}];
 if(!['choose','allCommitted','awaitHands'].includes(s.phase))return [];
 const memory=s.memories[actor][s.packets[actor]],inferred=s.hands[actor].includes(null)&&memory;
 const hand=inferred?Object.entries(memory.types).flatMap(([t,c])=>Array(c).fill(t)):s.hands[actor];
 return choices(hand,s.tableaux[actor],{unknown:!!inferred}).map(a=>({type:'commit',actor,...a}));
}
function validateChoice(s,p,a){if(!legalActions(s,p).some(b=>choiceKey(a)===choiceKey(b)))throw Error('Illegal card selection or chopsticks return');}
export function applyAction(state,a){
 if(state.mode!=='digital')throw Error('Use actual physical observations');assertValid(state);const s=clone(state);
 if(a.type==='commit'){if(!Number.isInteger(a.actor)||a.actor<0||a.actor>=s.players)throw Error('Invalid seat');validateChoice(s,a.actor,a);s.commitments[a.actor]={cards:a.cards.slice(),returnId:a.returnId??null};s.phase=s.commitments.every(Boolean)?'allCommitted':'choose';}
 else if(a.type==='uncommit'){if(!['choose','allCommitted'].includes(s.phase)||!Number.isInteger(a.actor)||a.actor<0||a.actor>=s.players)throw Error('Invalid cancellation');s.commitments[a.actor]=null;s.phase='choose';}
 else if(a.type==='reveal'){if(s.phase!=='allCommitted')throw Error('Every player must commit first');reveal(s);}
 else if(a.type==='nextRound'){if(s.phase!=='roundEnd')throw Error('Round not finished');deal(s);}
 else throw Error('Unknown action');assertValid(s);return s;
}
function bindType(s,p,type){
 let i=s.hands[p].findIndex(id=>typeOf(id)===type);if(i<0){i=s.hands[p].indexOf(null);if(i<0)throw Error('Played card is not in this packet');const used=new Set(allCards(s).filter(Boolean));const id=ALL_IDS.find(id=>typeOf(id)===type&&!used.has(id));if(!id)throw Error('Too many observed copies of '+type);s.hands[p][i]=id;}
 return s.hands[p].splice(i,1)[0];
}
function append(s,p,id){const entry={id,pick:s.pick};if(TYPES[typeOf(id)].nigiri){const empty=s.tableaux[p].find(e=>typeOf(e.id)==='wasabi'&&!s.tableaux[p].some(n=>n.wasabi===e.id));if(empty)entry.wasabi=empty.id;}s.tableaux[p].push(entry);}
export function reveal(s){
 const plays=clone(s.commitments);for(let p=0;p<s.players;p++)validateChoice(s,p,plays[p]);
 for(let p=0;p<s.players;p++){
  const a=plays[p],packet=s.packets[p];
  for(const type of a.cards)append(s,p,bindType(s,p,type));
  if(a.returnId){const i=s.tableaux[p].findIndex(e=>e.id===a.returnId);if(i<0||typeOf(a.returnId)!=='chopsticks')throw Error('Missing old chopsticks');s.tableaux[p].splice(i,1);s.hands[p].push(a.returnId);}
  for(const memory of s.memories){const m=memory[packet];if(!m)continue;for(const t of a.cards){if(!(m.types[t]>0))throw Error('Public pick contradicts recorded packet; correct the hand record first');m.types[t]--;if(!m.types[t])delete m.types[t];}if(a.returnId)m.types.chopsticks=(m.types.chopsticks??0)+1;m.size--;m.pick=s.pick;}
 }
 s.events.push({type:'reveal',round:s.round,pick:s.pick,packets:s.packets.slice(),plays});s.commitments=Array(s.players).fill(null);s.remaining--;
 if(s.remaining===0){
  const parts=roundScore(s.tableaux);s.roundScores.push(parts);for(let p=0;p<s.players;p++){s.scores[p]+=parts[p].total;for(const e of s.tableaux[p]){if(typeOf(e.id)==='pudding')s.puddings[p].push(e.id);else s.discard.push(e.id);}s.tableaux[p]=[];}
  s.memories=Array.from({length:s.players},()=>({}));s.pendingHands=Array(s.players).fill(false);
  if(s.round===3){const dessert=puddingScore(s.puddings.map(p=>p.length));s.dessertScores=dessert;for(let p=0;p<s.players;p++)s.scores[p]+=dessert[p];s.winners=winnersFor(s.scores,s.puddings.map(p=>p.length));s.phase='gameover';}else s.phase='roundEnd';
 }else{
  const hands=s.hands.slice(),packets=s.packets.slice();for(let p=0;p<s.players;p++){s.hands[(p+1)%s.players]=hands[p];s.packets[(p+1)%s.players]=packets[p];}s.pick++;s.pendingHands=Array(s.players).fill(s.mode==='physical');s.phase=s.mode==='physical'?'awaitHands':'choose';if(s.mode==='digital')for(let p=0;p<s.players;p++)rememberHand(s,p);
 }
}
export function physicalDeal(s){if(s.phase!=='roundEnd')throw Error('Round not finished');deal(s);}
export function allCards(s){return [...s.deck,...s.discard,...s.hands.flat(),...s.tableaux.flatMap(p=>p.map(e=>e.id)),...s.puddings.flat()];}
export const score=s=>s.scores.slice();
export const outcome=s=>s.phase==='gameover'?s.scores.map((_,p)=>s.winners.includes(p)?1/s.winners.length:0):null;
export function assertValid(s){
 const fail=()=>{throw Error('Invalid Sushi Go position');};
 if(!s||s.version!==1||s.edition!==EDITION||![2,3,4,5].includes(s.players)||!['physical','digital'].includes(s.mode)||!['setup','choose','allCommitted','awaitHands','roundEnd','gameover'].includes(s.phase)||!Number.isInteger(s.round)||s.round<1||s.round>3||!Number.isInteger(s.pick)||s.pick<1||s.pick>handSize(s.players))fail();
 const n=s.players;for(const f of ['hands','tableaux','puddings','scores','packets','commitments','memories','pendingHands'])if(!Array.isArray(s[f])||s[f].length!==n)fail();
 if(!Array.isArray(s.deck)||s.deckCount!==s.deck.length||!Array.isArray(s.discard)||!Array.isArray(s.roundScores)||!Array.isArray(s.events)||!Array.isArray(s.winners)||!Number.isInteger(s.remaining)||s.remaining<0||s.remaining>handSize(n))fail();
 if(new Set(s.packets).size!==n||s.packets.some(p=>typeof p!=='string'))fail();
 if(s.packets.some((packet,p)=>packet!==`${s.round}:${(p-s.pick+1+n*100)%n}`))fail();
 for(let p=0;p<n;p++){
  if(!Array.isArray(s.hands[p])||s.hands[p].length!==s.remaining||!Array.isArray(s.tableaux[p])||!Array.isArray(s.puddings[p])||!Number.isInteger(s.scores[p])||typeof s.pendingHands[p]!=='boolean'||!s.memories[p]||typeof s.memories[p]!=='object')fail();
  const table=s.tableaux[p];for(const [i,e] of table.entries()){
   if(!e||!CARDS[e.id]||!Number.isInteger(e.pick)||e.pick<1||e.pick>s.pick||(i>0&&table[i-1].pick>e.pick))fail();
   if(e.wasabi&&(!TYPES[typeOf(e.id)].nigiri||!table.slice(0,i).some(w=>w.id===e.wasabi&&typeOf(w.id)==='wasabi')||table.filter(w=>w.wasabi===e.wasabi).length!==1))fail();
   if(TYPES[typeOf(e.id)].nigiri&&!e.wasabi&&table.slice(0,i).some(w=>typeOf(w.id)==='wasabi'&&!table.slice(0,i).some(v=>v.wasabi===w.id)))fail();
  }
  if(table.length!==(['roundEnd','gameover'].includes(s.phase)?0:handSize(n)-s.remaining))fail();
  if(s.puddings[p].some(id=>typeOf(id)!=='pudding'))fail();
  for(const [packet,m] of Object.entries(s.memories[p]))if(!s.packets.includes(packet)||!m||!m.types||!Number.isInteger(m.size)||m.size<0||Object.entries(m.types).some(([t,c])=>!TYPES[t]||!Number.isInteger(c)||c<1)||Object.values(m.types).reduce((a,b)=>a+b,0)!==m.size)fail();
  if(s.commitments[p]){if(!['choose','allCommitted','awaitHands'].includes(s.phase))fail();try{validateChoice(s,p,s.commitments[p]);}catch{fail();}}
 }
 const cards=allCards(s),known=cards.filter(id=>id!==null);if(cards.length!==108||known.some(id=>!CARDS[id])||new Set(known).size!==known.length||(s.mode==='digital'&&known.length!==108)||(s.mode==='physical'&&s.deck.some(id=>id!==null)))fail();
 if((s.phase==='allCommitted')!==s.commitments.every(Boolean))fail();
 if(['roundEnd','gameover'].includes(s.phase)!==(s.remaining===0))fail();
 if(s.phase==='roundEnd'&&s.round===3)fail();if((s.phase==='setup'||s.phase==='awaitHands')&&s.mode!=='physical')fail();if(s.phase==='setup'&&s.pick!==1)fail();
 if(s.remaining>0&&s.pick!==handSize(n)-s.remaining+1)fail();
 if(s.roundScores.length!==(s.phase==='roundEnd'||s.phase==='gameover'?s.round:s.round-1))fail();
 const expectedDeck=108-s.round*n*handSize(n);if(s.deckCount!==expectedDeck)fail();
 for(const packet of s.packets){const owner=s.packets.indexOf(packet),known=s.hands[owner].filter(Boolean).map(typeOf),records=s.memories.flatMap(row=>row[packet]?[row[packet]]:[]);for(const m of records){if(m.size!==s.remaining||Object.entries(multiset(known)).some(([t,c])=>(m.types[t]??0)<c)||Object.entries(m.types).some(([t,c])=>c>TYPES[t].count))fail();for(const other of records)if(Object.keys(TYPES).some(t=>(m.types[t]??0)!==(other.types[t]??0)))fail();}}
 const accumulated=Array(n).fill(0);for(const round of s.roundScores){if(!Array.isArray(round)||round.length!==n)fail();for(let p=0;p<n;p++){const part=round[p];if(!part||['tempura','sashimi','dumpling','nigiri','maki','makiIcons','total'].some(k=>!Number.isInteger(part[k])||part[k]<0)||part.total!==part.tempura+part.sashimi+part.dumpling+part.nigiri+part.maki)fail();accumulated[p]+=part.total;}}
 if(s.phase==='gameover'){const dessert=puddingScore(s.puddings.map(p=>p.length));for(let p=0;p<n;p++)accumulated[p]+=dessert[p];if(s.round!==3||JSON.stringify(s.dessertScores)!==JSON.stringify(dessert)||JSON.stringify(s.winners)!==JSON.stringify(winnersFor(s.scores,s.puddings.map(p=>p.length))))fail();}else if(s.winners.length)fail();
 if(JSON.stringify(accumulated)!==JSON.stringify(s.scores))fail();return true;
}
