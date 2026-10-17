import {CARDS,WONDERS,PROGRESS,AGE_CARDS} from './catalog.js';
export const clone=s=>structuredClone(s);
export function rng(seed=1){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function shuffle(a,r){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const lists={1:[2,3,4,5,6],2:[6,5,4,3,2],3:[2,3,4,2,4,3,2]};
export function layout(age){const lengths=lists[age];let i=0;const rows=lengths.map((n,row)=>Array.from({length:n},(_,col)=>({index:i++,row,col,x:age===3&&row===3?col*4+3:6-n+col*2,up:row%2===0,covers:[]})));
 for(let r=1;r<rows.length;r++)for(const s of rows[r])for(const p of rows[r-1])if(Math.abs(s.x-p.x)<=1)s.covers.push(p.index);
 return rows.flat().map(s=>({...s,coveredBy:rows.flat().filter(t=>t.covers.includes(s.index)).map(t=>t.index)}));}
const player=()=>({coins:7,cards:[],wonders:[],built:[],progress:[]});
export function createGame({mode='physical',seed=1,firstPlayer=0}={}){
 if(!['physical','digital'].includes(mode)||![0,1].includes(firstPlayer))throw Error('Invalid setup');
 const s={version:1,mode,phase:'progress-setup',age:0,currentPlayer:firstPlayer,firstPlayer,players:[player(),player()],progress:[],wonderPool:[],draftStep:0,draftUsed:[],board:[],discard:[],spent:[],military:0,looted:[],turn:0,pending:[],replay:false,secret:null,result:null};
 if(mode==='digital'){const r=rng(seed);s.secret={wonderOrder:shuffle(Object.keys(WONDERS),r),ages:{1:shuffle(AGE_CARDS[1],r).slice(0,20),2:shuffle(AGE_CARDS[2],r).slice(0,20),3:shuffle([...shuffle(AGE_CARDS[3],r).slice(0,17),...shuffle(AGE_CARDS[4],r).slice(0,3)],r)},libraryOrder:shuffle(Object.keys(PROGRESS),r)};s.progress=shuffle(Object.keys(PROGRESS),r).slice(0,5);s.phase='wonder-draft';s.wonderPool=s.secret.wonderOrder.splice(0,4);}
 return s;
}
export const builtCount=s=>s.players.reduce((n,p)=>n+p.built.length,0);
export const count=(p,color)=>color==='wonders'?p.built.length:color==='treasury'?Math.floor(p.coins/3):p.cards.filter(id=>CARDS[id].color===color).length;
export function science(p){const a=p.cards.map(id=>CARDS[id].science).filter(Boolean);if(p.progress.includes('law'))a.push('law');return a;}
export const accessible=(s,i)=>!!s.board[i]&&!s.board[i].removed&&s.board[i].coveredBy.every(j=>s.board[j].removed);
export const visibleMissing=s=>s.board.map((x,i)=>x.up&&!x.removed&&!x.id?i:-1).filter(i=>i>=0);
export function production(p,onlyBasic=false){const fixed=[0,0,0,0,0],choices=[],discount=new Set();
 for(const c of [...p.cards.map(id=>CARDS[id]),...(!onlyBasic?p.built.map(id=>WONDERS[id]):[])]){
  if(onlyBasic&&!['brown','grey'].includes(c.color))continue;
  c.produce?.forEach((n,i)=>fixed[i]+=n);if(c.choice)choices.push(c.choice);c.discount?.forEach(i=>discount.add(i));
 }return{fixed,choices,discount};}
/** Exhaustive flexible-resource allocation, followed by the optimal rebate.
 * All minimum-price plans are retained (Economy receives exactly their trade). */
export function payment(s,who,item,{free=false}={}){const p=s.players[who];if(free||(item.chain&&p.cards.includes(item.chain)))return{total:0,trade:0,printed:0,chain:!free&&!!item.chain,missing:[0,0,0,0,0]};
 const {fixed,choices,discount}=production(p),other=production(s.players[1-who],true).fixed;
 const prices=fixed.map((_,i)=>discount.has(i)?1:2+other[i]);let best=null;
 const rebate=(item.color==='blue'&&p.progress.includes('masonry'))||(!item.color&&p.progress.includes('architecture'))?2:0;
 function evaluate(need){let trade=need.reduce((n,x,i)=>n+x*prices[i],0);const units=need.flatMap((x,i)=>Array(x).fill(i)).sort((a,b)=>prices[b]-prices[a]);const remaining=[...need];for(const i of units.slice(0,rebate)){trade-=prices[i];remaining[i]--;}
  if(!best||trade<best.trade)best={total:trade+(item.coins??0),trade,printed:item.coins??0,chain:false,missing:remaining};}
 function assign(n,need){if(n===choices.length){evaluate(need);return;}assign(n+1,need);for(const i of choices[n])if(need[i]){const next=[...need];next[i]--;assign(n+1,next);}}
 assign(0,item.cost.map((n,i)=>Math.max(0,n-fixed[i])));return best;
}
export function scoreBreakdown(s,who){const p=s.players[who],other=s.players[1-who];const out={blue:0,green:0,yellow:0,purple:0,wonders:0,progress:0,military:0,coins:Math.floor(p.coins/3)};
 for(const id of p.cards){const c=CARDS[id];if(c.guild){out.purple+=(c.rate??1)*Math.max(...[p,other].map(q=>c.guild.reduce((n,k)=>n+count(q,k),0)));}else if(c.points)out[c.color]+=c.points;}
 out.wonders=p.built.reduce((n,id)=>n+WONDERS[id].points,0);out.progress=p.progress.reduce((n,id)=>n+PROGRESS[id].points,0)+(p.progress.includes('mathematics')?3*p.progress.length:0);
 const advantage=s.military*(who===0?1:-1);out.military=advantage>=6?10:advantage>=3?5:advantage>=1?2:0;return out;}
export const score=(s,who)=>Object.values(scoreBreakdown(s,who)).reduce((a,b)=>a+b,0);
function finishGame(s,reason,winner){s.phase='gameover';s.pending=[];s.result={reason,winners:winner===null?[0,1]:[winner],scores:s.players.map((_,i)=>score(s,i))};}
function supremacy(s,who){if(Math.abs(s.military)>=9){finishGame(s,'military',s.military>0?0:1);return true;}if(new Set(science(s.players[who])).size>=6){finishGame(s,'science',who);return true;}return false;}
function shields(s,who,n){const sign=who===0?1:-1;s.military=Math.max(-9,Math.min(9,s.military+sign*n));for(const [threshold,loss] of [[3,2],[6,5]]){const key=sign*threshold;if(s.military*sign>=threshold&&!s.looted.includes(key)){s.looted.push(key);s.players[1-who].coins=Math.max(0,s.players[1-who].coins-loss);}}}
function grant(s,id){const p=s.players[s.currentPlayer];p.progress.push(id);p.coins+=PROGRESS[id].gain;supremacy(s,s.currentPlayer);}
function construct(s,id,free=false){const who=s.currentPlayer,p=s.players[who],c=CARDS[id],pay=payment(s,who,c,{free});p.coins-=pay.total;if(s.players[1-who].progress.includes('economy'))s.players[1-who].coins+=pay.trade;
 const before=c.science?science(p).filter(x=>x===c.science).length:0;p.cards.push(id);p.coins+=c.gain??0;
 if(pay.chain&&p.progress.includes('urbanism'))p.coins+=4;
 if(c.per)p.coins+=(c.rate??1)*count(p,c.per);
 if(c.guild&&!['wonders','treasury'].includes(c.guild[0]))p.coins+=Math.max(...s.players.map(q=>c.guild.reduce((n,color)=>n+count(q,color),0)));
 if(c.shields)shields(s,who,c.shields+(p.progress.includes('strategy')?1:0));
 if(supremacy(s,who))return;
 if(before===1&&s.progress.length)s.pending.push('progress');
}
function startAge(s,age){s.age=age;s.board=layout(age).map(x=>({...x,id:s.mode==='digital'?s.secret.ages[age][x.index]:null,removed:false}));s.phase='play';settle(s);}
function settle(s){if(s.phase==='gameover')return;
 // Effects are resolved explicitly before ending the turn. Empty effects vanish.
 while(s.pending.length){const phase=s.pending[0],p=s.players[s.currentPlayer];
  if(phase==='destroy'&&!s.players[1-s.currentPlayer].cards.some(id=>CARDS[id].color===s.destroyColor)){s.pending.shift();continue;}
  if(phase==='recover'&&!s.discard.length){s.pending.shift();continue;}
  if(phase==='progress'&&!s.progress.length){s.pending.shift();continue;}
  if(phase==='library-offer'&&s.mode==='digital'){s.libraryOffer=s.secret.libraryOrder.filter(id=>!s.progress.includes(id)&&!s.players.some(p=>p.progress.includes(id))).slice(0,3);s.pending[0]='library';continue;}
  s.phase=phase;return;
 }
 if(visibleMissing(s).length){s.phase='reveal';return;}
 if(s.board.length&&s.board.every(x=>x.removed)){
  if(s.age===3){const scores=[score(s,0),score(s,1)],blue=s.players.map((_,i)=>scoreBreakdown(s,i).blue);const d=scores[0]-scores[1]||blue[0]-blue[1];finishGame(s,'civilian',d===0?null:d>0?0:1);}
  else{s.currentPlayer=s.military>0?1:s.military<0?0:s.lastActor;s.phase='starter';}return;
 }
 if(s.endTurn){s.currentPlayer=s.replay?s.lastActor:1-s.lastActor;s.replay=false;s.endTurn=false;}
 s.phase='play';
}
export function legalActions(s){const p=s.players[s.currentPlayer];switch(s.phase){
 case 'wonder-draft':return s.wonderPool.map(id=>({type:'pick-wonder',id}));
 case 'starter':return[0,1].map(player=>({type:'starter',player}));
 case 'progress':return s.progress.map(id=>({type:'progress',id}));
 case 'library':return s.libraryOffer.map(id=>({type:'library',id}));
 case 'destroy':return s.players[1-s.currentPlayer].cards.filter(id=>CARDS[id].color===s.destroyColor).map(id=>({type:'destroy',id}));
 case 'recover':return s.discard.map(id=>({type:'recover',id}));
 case 'play':{const actions=[];for(let i=0;i<s.board.length;i++)if(accessible(s,i)&&s.board[i].id){const id=s.board[i].id;actions.push({type:'discard',slot:i});if(payment(s,s.currentPlayer,CARDS[id]).total<=p.coins)actions.push({type:'build',slot:i});if(builtCount(s)<7)for(const w of p.wonders)if(!p.built.includes(w)&&payment(s,s.currentPlayer,WONDERS[w]).total<=p.coins)actions.push({type:'wonder',slot:i,id:w});}return actions;}
 default:return[];}}
export function applyAction(state,action,{validate=true}={}){if(validate)validateState(state);if(!action||!legalActions(state).some(a=>JSON.stringify(a)===JSON.stringify(action)))throw Error('Illegal action');const s=clone(state),p=s.players[s.currentPlayer];
 if(action.type==='pick-wonder'){
  p.wonders.push(action.id);s.draftUsed.push(action.id);s.wonderPool=s.wonderPool.filter(id=>id!==action.id);s.draftStep++;
  if(s.draftStep===8){startAge(s,1);s.currentPlayer=s.firstPlayer;}
  else{const order=[0,1,1,0,1,0,0,1];s.currentPlayer=s.firstPlayer^order[s.draftStep];if(s.draftStep===4){if(s.mode==='digital')s.wonderPool=s.secret.wonderOrder.splice(0,4);else s.phase='wonder-offer';}}
 }else if(action.type==='starter'){s.currentPlayer=action.player;s.endTurn=false;s.replay=false;startAge(s,s.age+1);}
 else if(['progress','library'].includes(action.type)){if(action.type==='progress')s.progress=s.progress.filter(id=>id!==action.id);else delete s.libraryOffer;s.pending.shift();grant(s,action.id);settle(s);}
 else if(action.type==='destroy'){s.players[1-s.currentPlayer].cards=s.players[1-s.currentPlayer].cards.filter(id=>id!==action.id);s.discard.push(action.id);s.pending.shift();settle(s);}
 else if(action.type==='recover'){s.discard=s.discard.filter(id=>id!==action.id);s.pending.shift();construct(s,action.id,true);settle(s);}
 else{
  const slot=s.board[action.slot],id=slot.id;slot.removed=true;slot.id=null;s.turn++;s.lastActor=s.currentPlayer;s.endTurn=true;s.replay=false;
  if(action.type==='discard'){s.discard.push(id);p.coins+=2+count(p,'yellow');}
  else if(action.type==='build')construct(s,id);
  else{const w=WONDERS[action.id],pay=payment(s,s.currentPlayer,w);p.coins-=pay.total;if(s.players[1-s.currentPlayer].progress.includes('economy'))s.players[1-s.currentPlayer].coins+=pay.trade;p.built.push(w.id);s.spent.push(id);p.coins+=w.gain??0;s.players[1-s.currentPlayer].coins=Math.max(0,s.players[1-s.currentPlayer].coins-(w.loot??0));s.replay=!!w.replay||p.progress.includes('theology');if(w.shields)shields(s,s.currentPlayer,w.shields);
   if(!supremacy(s,s.currentPlayer)){if(w.destroy){s.destroyColor=w.destroy;s.pending.push('destroy');}if(w.recover)s.pending.push('recover');if(w.library)s.pending.push('library-offer');}}
  for(let i=0;i<s.board.length;i++)if(accessible(s,i))s.board[i].up=true;
  settle(s);
 }
 if(validate)validateState(s);return s;
}
const unique=a=>new Set(a).size===a.length;
const choose=(a,catalog,n)=>Array.isArray(a)&&a.length===n&&unique(a)&&a.every(id=>!!catalog[id]);
/** Observation transitions are transactional; never supply real hidden age cards. */
export function observe(state,event){const s=clone(state);if(s.mode!=='physical')throw Error('Only physical sessions accept observations');
 if(event.type==='progress'&&s.phase==='progress-setup'){if(!choose(event.ids,PROGRESS,5))throw Error('Select the five actual progress tokens');s.progress=[...event.ids];s.phase='wonder-offer';}
 else if(event.type==='wonder-offer'&&s.phase==='wonder-offer'){if(!choose(event.ids,WONDERS,4)||event.ids.some(id=>s.draftUsed.includes(id)))throw Error('Enter four unused wonders');s.wonderPool=[...event.ids];s.phase='wonder-draft';}
 else if(event.type==='card'&&s.phase==='reveal'){const slot=s.board[event.slot],c=CARDS[event.id];if(!slot||slot.removed||!slot.up||slot.id||!c||(c.age!==s.age&&!(s.age===3&&c.age===4)))throw Error('Card does not belong in this visible slot');slot.id=event.id;settle(s);}
 else if(event.type==='library'&&s.phase==='library-offer'){const excluded=[...s.progress,...s.players.flatMap(p=>p.progress)];if(!choose(event.ids,PROGRESS,3)||event.ids.some(id=>excluded.includes(id)))throw Error('Enter the actual three box tokens privately');s.libraryOffer=[...event.ids];s.pending[0]='library';settle(s);}
 else throw Error('Observation not expected');validateState(s);return s;}
export function analysisBlocker(s){return ['progress-setup','wonder-offer','reveal','library-offer'].includes(s.phase)?'Enter the actual observed components before analysis.':s.phase==='gameover'?'Game complete.':null;}
/** Public information plus the actor's current private Library offer; no actual deck. */
export function observation(state,viewer=state.currentPlayer){const s=clone(state);delete s.secret;for(const x of s.board)if(!x.up)x.id=null;if(s.libraryOffer&&viewer!==s.currentPlayer){delete s.libraryOffer;s.phase='library-offer';s.pending[0]='library-offer';}return s;}
export function knownCards(s){return [...s.players.flatMap(p=>p.cards),...s.discard,...s.spent,...s.board.filter(x=>!x.removed&&x.id).map(x=>x.id)];}
/** Belief worlds use only remaining catalog identities. Unselected setup cards stay unknown. */
export function determinize(o,random=rng(1)){const s=clone(o),known=new Set(knownCards(o));s.mode='digital';s.secret={ages:{},wonderOrder:shuffle(Object.keys(WONDERS).filter(id=>!s.draftUsed.includes(id)&&!s.wonderPool.includes(id)),random),libraryOrder:shuffle(Object.keys(PROGRESS),random)};
 for(let age=Math.max(1,s.age);age<=3;age++){
  const pool=shuffle(AGE_CARDS[age].filter(id=>!known.has(id)),random),guild=shuffle(AGE_CARDS[4].filter(id=>!known.has(id)),random);
  if(age===s.age){const hidden=s.board.filter(x=>!x.removed&&!x.id);let regularCount=hidden.length;if(age===3){const knownGuild=knownCards(s).filter(id=>CARDS[id].age===4).length;const g=Math.max(0,3-knownGuild);const selected=shuffle([...pool.slice(0,Math.max(0,hidden.length-g)),...guild.slice(0,Math.min(g,hidden.length))],random);for(const x of hidden)x.id=selected.pop();}else for(const x of hidden)x.id=pool.pop();s.secret.ages[age]=s.board.map(x=>x.id);}
  else s.secret.ages[age]=age<3?pool.slice(0,20):shuffle([...pool.slice(0,17),...guild.slice(0,3)],random);
 }
 return s;}
export function validateState(s){const fail=m=>{throw Error('Invalid 7 Wonders Duel state: '+m);};if(!s||s.version!==1||!['physical','digital'].includes(s.mode)||!Number.isInteger(s.age)||s.age<0||s.age>3||![0,1].includes(s.currentPlayer)||![0,1].includes(s.firstPlayer))fail('header');
 const phases=['progress-setup','wonder-offer','wonder-draft','play','reveal','starter','progress','destroy','recover','library-offer','library','gameover'];if(!phases.includes(s.phase)||!Array.isArray(s.players)||s.players.length!==2)fail('phase/players');
 for(const p of s.players){if(!Number.isInteger(p.coins)||p.coins<0||!Array.isArray(p.cards)||!p.cards.every(id=>CARDS[id])||!Array.isArray(p.wonders)||!p.wonders.every(id=>WONDERS[id])||!Array.isArray(p.built)||!p.built.every(id=>p.wonders.includes(id))||!Array.isArray(p.progress)||!p.progress.every(id=>PROGRESS[id])||!unique(p.built))fail('city');}
 if(!Array.isArray(s.board)||s.board.length!==(s.age?20:0))fail('board size');
 const canonical=s.age?layout(s.age):[];for(let i=0;i<s.board.length;i++){const x=s.board[i],t=canonical[i];if(typeof x.up!=='boolean'||typeof x.removed!=='boolean'||!Array.isArray(x.coveredBy)||JSON.stringify(x.coveredBy)!==JSON.stringify(t.coveredBy)||x.index!==t.index||x.col!==t.col||x.row!==t.row||x.x!==t.x||(!x.up&&t.up)||(!x.id&&!x.removed&&s.mode==='digital')||(x.removed&&x.id!==null))fail('slot');if(x.removed&&!x.coveredBy.every(j=>s.board[j].removed)||!t.up&&x.up&&!x.removed&&!accessible(s,i)||s.mode==='physical'&&!x.up&&x.id!==null)fail('structure chronology');if(x.id&&(!CARDS[x.id]||!(CARDS[x.id].age===s.age||s.age===3&&CARDS[x.id].age===4)))fail('age card');}
 const ids=knownCards(s);if(!unique(ids)||!ids.every(id=>CARDS[id]))fail('duplicate card');
 for(let age=1;age<=4;age++)if(ids.filter(id=>CARDS[id].age===age).length>(age===4?3:age===3?17:20))fail('age inventory');
 const ws=[...s.players.flatMap(p=>p.wonders),...s.wonderPool];if(!unique(ws)||!ws.every(id=>WONDERS[id])||s.players.some(p=>p.wonders.length>4)||builtCount(s)>7)fail('wonders');
 const ps=[...s.progress,...s.players.flatMap(p=>p.progress)];if(!unique(ps)||!ps.every(id=>PROGRESS[id])||s.progress.length>5)fail('progress');
 if(!Number.isInteger(s.military)||Math.abs(s.military)>9||!Array.isArray(s.looted)||!unique(s.looted)||!s.looted.every(x=>[-6,-3,3,6].includes(x))||!Number.isInteger(s.turn)||s.turn<0)fail('track');
 if(typeof s.replay!=='boolean'||(s.endTurn!==undefined&&typeof s.endTurn!=='boolean')||!Number.isInteger(s.draftStep)||s.draftStep<0||s.draftStep>8||!Array.isArray(s.draftUsed)||!unique(s.draftUsed)||!s.draftUsed.every(id=>WONDERS[id])||s.draftUsed.length!==s.players.reduce((n,p)=>n+p.wonders.length,0)||!s.players.flatMap(p=>p.wonders).every(id=>s.draftUsed.includes(id)))fail('draft');
 if(s.destroyColor!==undefined&&!['brown','grey'].includes(s.destroyColor))fail('destroy color');
 if(s.mode==='physical'&&s.secret)fail('physical session contains hidden deck');
 if(s.mode==='digital'){
  if(!s.secret||!s.secret.ages||!Array.isArray(s.secret.wonderOrder)||!s.secret.wonderOrder.every(id=>WONDERS[id])||!unique([...s.secret.wonderOrder,...ws])||!choose(s.secret.libraryOrder,PROGRESS,10))fail('digital hidden state');
  for(let age=Math.max(1,s.age);age<=3;age++){const deck=s.secret.ages[age];if(!Array.isArray(deck)||deck.length!==20||!unique(deck.filter(Boolean))||!deck.every((id,i)=>id===null&&age===s.age&&s.board[i].removed||CARDS[id]&&(CARDS[id].age===age||age===3&&CARDS[id].age===4)))fail('digital age deck');if(age>s.age&&age===3&&deck.filter(id=>CARDS[id]?.age===4).length!==3)fail('digital guild count');if(age===s.age&&s.board.some((x,i)=>!x.removed&&x.id!==deck[i]))fail('digital board/deck mismatch');}
 }
 if(!Array.isArray(s.discard)||!Array.isArray(s.spent)||!Array.isArray(s.pending)||!s.pending.every(x=>['progress','destroy','recover','library-offer','library'].includes(x)))fail('effects');
 if(!['progress-setup','wonder-offer','wonder-draft'].includes(s.phase)&&(s.age<1||s.draftStep!==8||s.draftUsed.length!==8))fail('incomplete setup');
 if(s.phase==='play'&&(visibleMissing(s).length||!legalActions(s).length))fail('unready play');
 if(s.phase==='reveal'&&!visibleMissing(s).length)fail('empty reveal');
 if(s.phase==='library'&&(!choose(s.libraryOffer,PROGRESS,3)||s.libraryOffer.some(id=>ps.includes(id))))fail('library offer');
 if(s.phase==='gameover'&&(!s.result||!['military','science','civilian'].includes(s.result.reason)||!Array.isArray(s.result.winners)||!s.result.winners.length||!s.result.winners.every(x=>x===0||x===1)))fail('result');
 if(s.phase==='gameover'&&(!unique(s.result.winners)))fail('duplicate winners');
 if(s.phase==='gameover'&&(!Array.isArray(s.result.scores)||s.result.scores.length!==2||s.result.scores.some((v,i)=>!Number.isInteger(v)||v!==score(s,i))))fail('result scores');
 if(s.phase==='gameover'){
  const r=s.result;let expected;
  if(r.reason==='military'){if(Math.abs(s.military)!==9)fail('military result');expected=[s.military>0?0:1];}
  else if(r.reason==='science'){expected=s.players.flatMap((p,i)=>new Set(science(p)).size>=6?[i]:[]);if(expected.length!==1)fail('science result');}
  else{if(s.age!==3||s.board.some(x=>!x.removed))fail('civilian result');const d=score(s,0)-score(s,1)||scoreBreakdown(s,0).blue-scoreBreakdown(s,1).blue;expected=d===0?[0,1]:[d>0?0:1];}
  if(JSON.stringify(r.winners)!==JSON.stringify(expected))fail('winner');
 }
 const effectPhases=['progress','destroy','recover','library-offer','library'];if(effectPhases.includes(s.phase)&&(s.pending[0]!==s.phase||!legalActions(s).length&&s.phase!=='library-offer'))fail('effect phase');
 if(s.phase==='starter'&&(s.age<1||s.age>2||s.board.some(x=>!x.removed)||s.currentPlayer!==(s.military>0?1:s.military<0?0:s.lastActor)))fail('next age');
 if(s.phase==='wonder-draft'&&(!s.wonderPool.length||s.draftStep>=8||s.currentPlayer!==(s.firstPlayer^[0,1,1,0,1,0,0,1][s.draftStep])))fail('wonder draft');
 if(['progress-setup','wonder-offer','wonder-draft'].includes(s.phase)&&s.age!==0)fail('setup age');
 return true;}
export function actionLabel(s,a){const id=a.slot===undefined?a.id:s.board[a.slot]?.id;const name=CARDS[id]?.name??WONDERS[id]?.name??PROGRESS[id]?.name??'';if(a.type==='starter')return`Player ${a.player+1} starts Age ${s.age+1}`;if(a.type==='wonder')return`Build ${WONDERS[a.id].name} using ${name} (${payment(s,s.currentPlayer,WONDERS[a.id]).total} coins)`;if(a.type==='build')return`Build ${name} (${payment(s,s.currentPlayer,CARDS[id]).total} coins)`;if(a.type==='discard')return`Discard ${name} (+${2+count(s.players[s.currentPlayer],'yellow')} coins)`;return`${a.type.replaceAll('-',' ')}: ${name}`;}
