import {CITIES,CITY_BY_ID,ROUTES,ROUTE_BY_ID,ROUTE_POINTS,TICKETS,TICKET_BY_ID,TRAIN_COLORS} from './catalog.js';
import {newGame,legalActions,applyAction,recordObservation,cancelPending,assertValid,analysisBlocker,score,outcome} from './core.js';
import {publicObservation} from './observations.js';
import {readSession} from '../shared/session.js';
const $=id=>document.getElementById(id),KEY='board-game-ai-ticket-to-ride-v1',FORMAT='board-game-ai-ticket-to-ride';
const colors={purple:'#a15e9f',blue:'#377ba1',orange:'#ca7b3a',white:'#faf8ed',green:'#53875f',yellow:'#d6b843',black:'#303e43',red:'#bd5146',gray:'#a5aaa4',locomotive:'#8a668e'};
const seatColors=['#367eaa','#bf534a','#538561','#c29b40','#735f8e'];
let history=[],index=0,state,selected=null,revealed=false,generation=0,worker;
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ticketName=id=>{const t=TICKET_BY_ID[id];return t?`${CITY_BY_ID[t.a].name} → ${CITY_BY_ID[t.b].name} · ${t.value}`:'Unknown ticket';};
function label(a){if(a.type==='claim'){const r=ROUTE_BY_ID[a.route];return `${CITY_BY_ID[r.a].name} – ${CITY_BY_ID[r.b].name}: ${r.length} ${r.color}; pay ${a.payment.count} ${a.payment.color} + ${a.payment.locomotive} locomotive`;}if(a.type==='keepTickets')return `Keep ${a.keep.map(i=>ticketName(state.offer[i])).join('; ')}`;if(a.type==='drawTrain')return a.source==='blind'?'Draw a blind train card':`Draw ${state.market[a.index]} from market slot ${a.index+1}`;return 'Draw destination tickets';}
function message(text){$('status').textContent=text;}
function stop(){generation++;worker?.postMessage({type:'stop',generation:generation-1});$('recommendations').replaceChildren();}
function save(){localStorage.setItem(KEY,JSON.stringify({format:FORMAT,version:1,history,index,seats:state.players.map(()=> 'human')}));}
function load(data){const read=readSession(data,{format:FORMAT,validateState:assertValid,playerCount:s=>s.players.length});history=read.history;index=read.index;state=read.game;selected=null;revealed=false;stop();save();render();}
function commit(next,text){if(state.mode==='physical'&&index!==history.length-1)throw Error('Return to the latest physical record before recording a correction or action');history=history.slice(0,index+1);history.push({state:next,label:text});index=history.length-1;state=next;selected=null;revealed=false;stop();save();render();}
function safe(fn){try{fn();}catch(e){message(e.message);}}
function options(values,current=null){return values.map(([value,name])=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(name)}</option>`).join('');}
function colorSelect(id,value=null){return `<select id="${id}" aria-label="${id}">${options([['','Unknown'],...TRAIN_COLORS.map(c=>[c,c])],value??'')}</select>`;}
function ticketSelect(id,value=null){return `<select id="${id}" aria-label="${id}">${options([['','Unknown'],...TICKETS.map(t=>[t.id,ticketName(t.id)])],value??'')}</select>`;}
function choose(a){selected=a;$('action-preview').textContent=`Preview: ${label(a)}. No move has been recorded.`;$('confirm').disabled=false;drawMap();}
function selectRoute(id){
 if(!revealed){selected=null;$('confirm').disabled=true;$('action-preview').textContent='Reveal the active seat before inspecting its possible payments.';return;}
 const r=ROUTE_BY_ID[id],payments=legalActions(state).filter(a=>a.type==='claim'&&a.route===id);
 $('action-preview').innerHTML=`<p>${escape(CITY_BY_ID[r.a].name)} ↔ ${escape(CITY_BY_ID[r.b].name)} · ${r.length} ${r.color}</p>`;
 if(!payments.length){$('action-preview').append(document.createTextNode('No legal claim with the entered hand and train supply.'));$('confirm').disabled=true;selected=null;return;}
 const select=document.createElement('select');select.id='payment';select.setAttribute('aria-label','Claim payment');
 payments.forEach((a,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${a.payment.count} ${a.payment.color} + ${a.payment.locomotive} locomotive`;select.append(option);});
 const hint=document.createElement('p');hint.textContent='Select a payment, then confirm the claim.';$('action-preview').append(select,hint);selected=payments[0];$('confirm').disabled=false;
 select.onchange=()=>{selected=payments[Number(select.value)];};
}
function drawMap(){
 const nodes=ROUTES.map(r=>{const a=CITY_BY_ID[r.a],b=CITY_BY_ID[r.b],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),mate=ROUTES.filter(x=>x.parallelGroup&&x.parallelGroup===r.parallelGroup),offset=mate.length?(mate.indexOf(r)?5:-5):0,nx=-dy/len*offset,ny=dx/len*offset;
  const owner=state.claimed[r.id],claimed=Object.hasOwn(state.claimed,r.id),stroke=claimed?seatColors[owner]:colors[r.color];
  return `<g><line class="route" tabindex="0" role="button" aria-label="${escape(`${CITY_BY_ID[r.a].name} to ${CITY_BY_ID[r.b].name}, ${r.length} ${r.color}${claimed?`, claimed by seat ${owner+1}`:''}`)}" data-route="${r.id}" x1="${a.x+nx}" y1="${a.y+ny}" x2="${b.x+nx}" y2="${b.y+ny}" stroke="#a39780" stroke-width="9"/><line pointer-events="none" x1="${a.x+nx}" y1="${a.y+ny}" x2="${b.x+nx}" y2="${b.y+ny}" stroke="${stroke}" stroke-width="6" stroke-dasharray="${Math.max(2,(len-8)/r.length-4)} 4"/><title>${r.length} ${r.color}</title></g>`;}).join('');
 $('map').innerHTML=`<svg viewBox="45 55 920 510" role="img" aria-label="Schematic original USA route map"><path d="M95 100L220 70 420 80 560 125 700 110 870 65 945 125 900 280 870 400 915 540 850 500 770 450 650 500 550 500 400 485 260 470 135 450 70 350Z" fill="#e3dfc6" stroke="#c5bea4"/>${nodes}${CITIES.map(c=>`<circle cx="${c.x}" cy="${c.y}" r="5" fill="#fffdf4" stroke="#625440" stroke-width="2"/><text class="city-label" x="${c.x+7}" y="${c.y-8}">${escape(c.name)}</text>`).join('')}</svg>`;
 document.querySelectorAll('[data-route]').forEach(el=>{el.onclick=()=>selectRoute(el.dataset.route);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectRoute(el.dataset.route);}};});
}
function renderActions(){
 const container=$('actions');container.replaceChildren();$('confirm').disabled=true;$('action-preview').textContent='Select an action to preview.';
 if(state.mode==='physical'&&index!==history.length-1){container.textContent='Viewing history. Return to Latest before recording tabletop changes.';return;}
 if(state.phase==='setup'){
  container.innerHTML='<p>Enter the five actual face-up train cards. Opponent hands stay unknown.</p>'+Array.from({length:5},(_,i)=>`<label>Market ${i+1}${colorSelect('setup-market-'+i)}</label>`).join('')+state.players.map((_,i)=>`<label>Seat ${i+1}: initial tickets kept<select id="kept-${i}"><option>2</option><option>3</option></select></label>`).join('')+'<button id="record-setup">Record table setup</button>';
  $('record-setup').onclick=()=>safe(()=>{const market=Array.from({length:5},(_,i)=>$('setup-market-'+i).value);if(market.some(c=>!c))throw Error('Enter every market card');commit(recordObservation(state,{type:'setup',market,keptCounts:state.players.map((_,i)=>Number($('kept-'+i).value))}),'Recorded actual setup');});return;
 }
 if(['refill','trainObservation'].includes(state.phase)){
  container.innerHTML=`<p>${state.phase==='refill'?'Enter the actual market refill, one card at a time.':'Privately enter the actual blind draw.'}</p>${colorSelect('observed-color')}<button id="record-card">Record observed card</button>`;
  $('record-card').onclick=()=>safe(()=>commit(recordObservation(state,{type:'trainCard',color:$('observed-color').value||null}),'Recorded train-card observation'));
  if(state.phase==='trainObservation'){const cancel=document.createElement('button');cancel.textContent='Cancel before seeing card';cancel.onclick=()=>safe(()=>commit(cancelPending(state),'Cancelled unobserved draw'));container.append(cancel);}return;
 }
 if(state.phase==='ticketObservation'){
  container.innerHTML='<p>For an opponent, record only how many tickets they keep.</p><label>Tickets kept<select id="unknown-kept">'+Array.from({length:state.offer.length},(_,i)=>`<option>${i+1}</option>`).join('')+'</select></label><button id="record-unknown-retention">Record unknown ticket selection</button>';
  $('record-unknown-retention').onclick=()=>safe(()=>commit(recordObservation(state,{type:'unknownTicketRetention',keptCount:Number($('unknown-kept').value)}),'Recorded opponent ticket keep count'));
  if(revealed){container.insertAdjacentHTML('beforeend','<p>Or privately enter every offered ticket.</p>'+state.offer.map((_,i)=>ticketSelect('offer-'+i)).join('')+'<button id="record-offer">Record private offer</button>');$('record-offer').onclick=()=>safe(()=>commit(recordObservation(state,{type:'ticketOffer',tickets:state.offer.map((_,i)=>$('offer-'+i).value)}),'Recorded private ticket offer'));}return;
 }
 if(state.phase==='supplyAdjudication'){container.textContent=`Table adjudication required: ${state.pending.reason}. Preserve the record and use the correction/ruling panel below. This game is unresolved.`;return;}
 if(state.phase==='terminal'){const result=outcome(state);container.textContent=result.complete?`Journey complete. Winning seat${result.winners.length>1?'s':''}: ${result.winners.map(s=>s+1).join(', ')}.`:'Reveal all remaining destination tickets for final scoring.';
  state.players.forEach((p,seat)=>{const section=document.createElement('section');section.innerHTML=`<h3>Seat ${seat+1} final tickets</h3>`+p.tickets.map((id,i)=>state.mode==='physical'?ticketSelect(`final-ticket-${seat}-${i}`,id):`<p>${escape(ticketName(id))}</p>`).join('');if(state.mode==='physical'){const button=document.createElement('button');button.textContent=`Record seat ${seat+1} final tickets`;button.onclick=()=>safe(()=>commit(recordObservation(state,{type:'finalTickets',seat,tickets:p.tickets.map((_,i)=>$(`final-ticket-${seat}-${i}`).value)}),`Seat ${seat+1} revealed final tickets`));section.append(button);}container.append(section);});return;}
 if(state.phase==='keepTickets'){
  if(!revealed){container.textContent='Reveal the active seat to inspect its private ticket offer.';return;}
  container.innerHTML=state.offer.map((id,i)=>`<label class="ticket"><span><input type="checkbox" data-keep="${i}"> ${escape(ticketName(id))}</span></label>`).join('')+'<button id="preview-keep">Preview ticket selection</button>';
  $('preview-keep').onclick=()=>{const keep=[...document.querySelectorAll('[data-keep]:checked')].map(e=>Number(e.dataset.keep));const a=legalActions(state).find(a=>a.type==='keepTickets'&&JSON.stringify(a.keep)===JSON.stringify(keep));if(a)choose(a);else message(`Keep at least ${state.setupRemaining?2:1} tickets.`);};return;
 }
 const actions=legalActions(state),draws=actions.filter(a=>a.type==='drawTrain');const market=document.createElement('div');market.className='market';
 draws.forEach(a=>{const button=document.createElement('button');button.textContent=a.source==='blind'?'Blind draw':`${a.index+1}: ${state.market[a.index]}`;button.style.setProperty('--color',colors[state.market[a.index]]||'#718582');button.onclick=()=>choose(a);market.append(button);});container.append(market);
 if(actions.some(a=>a.type==='drawTickets')){const b=document.createElement('button');b.textContent='Draw destination tickets';b.onclick=()=>choose({type:'drawTickets'});container.append(b);}
 const routeLabel=document.createElement('label');routeLabel.textContent='Inspect a route';const routes=document.createElement('select');routes.id='route-choice';routes.innerHTML='<option value="">Choose endpoints…</option>'+ROUTES.map(r=>`<option value="${r.id}">${escape(CITY_BY_ID[r.a].name+' – '+CITY_BY_ID[r.b].name+' · '+r.length+' '+r.color)}</option>`).join('');routes.onchange=()=>{if(routes.value)selectRoute(routes.value);};routeLabel.append(routes);container.append(routeLabel);
}
function renderPrivate(){
 $('private').hidden=!revealed;$('privacy-note').textContent=revealed?`Seat ${state.turn+1} private cards are visible.`:'Concealed for passing the device.';$('reveal').textContent=revealed?'Conceal cards':'Reveal active seat';
 if(!revealed){$('private').replaceChildren();return;}
 const p=state.players[state.turn];
 $('private').innerHTML=`<p>${p.hand.length} train cards</p><div class="private-cards">${p.hand.map((c,i)=>colorSelect('hand-'+i,c)).join('')}</div><p>${p.tickets.length} destination tickets</p>${p.tickets.map((id,i)=>ticketSelect('ticket-'+i,id)).join('')}${state.mode==='physical'?'<button id="save-private">Record actual private cards</button>':''}`;
 if(state.mode==='digital')$('private').querySelectorAll('select').forEach(e=>e.disabled=true);
 if($('save-private'))$('save-private').onclick=()=>safe(()=>commit(recordObservation(state,{type:'privateCards',seat:state.turn,hand:p.hand.map((_,i)=>$('hand-'+i).value||null),tickets:p.tickets.map((_,i)=>$('ticket-'+i).value||null)}),'Recorded active seat private cards'));
}
function render(){
 const scores=state.phase==='terminal'?score(state):state.players.map((_,seat)=>({routePoints:ROUTES.filter(r=>state.claimed[r.id]===seat).reduce((n,r)=>n+ROUTE_POINTS[r.length],0)}));$('scoreboard').innerHTML=state.players.map((p,i)=>`<div class="seat ${state.turn===i?'active':''}" style="--seat:${seatColors[i]}"><strong>Seat ${i+1} · ${scores[i].routePoints} route points</strong><small>${p.trains} trains · ${p.hand.length} cards · ${p.tickets.length} tickets</small>${state.phase==='terminal'?`<small>Trail ${scores[i].trail.length}; ticket points ${scores[i].ticketPoints??'unknown'}; total ${scores[i].total??'pending'}</small>`:''}</div>`).join('');
 $('turn-label').textContent=`Seat ${state.turn+1} · ${state.phase.replace(/([A-Z])/g,' $1').toLowerCase()}`;
 $('round').textContent=state.finalRound?`Final round · ${state.finalRound.remaining} turns remain`:'45 trains. A continent of possibilities.';
 $('legend').innerHTML=Object.entries(colors).filter(([c])=>c!=='locomotive').map(([c,color])=>`<span><i class="swatch" style="background:${color}"></i>${c}</span>`).join('');
 renderActions();renderPrivate();drawMap();$('history-status').textContent=`Record ${index+1} of ${history.length}${state.mode==='physical'&&index<history.length-1?' · historical view only':''}`;
 $('timeline').innerHTML=history.map((h,i)=>`<li>${i===index?'→ ':''}${escape(h.label)}</li>`).join('');$('undo').disabled=index===0;$('redo').disabled=index===history.length-1;
 $('corrected-state').value='';$('setup-panel').hidden=true;$('analysis-status').textContent=analysisBlocker(state)||'Ready. Advice previews never record a move.';
}
$('new-toggle').onclick=()=>{$('setup-panel').hidden=!$('setup-panel').hidden;};
$('new-form').onsubmit=e=>{e.preventDefault();safe(()=>{const s=newGame({players:Number($('players').value),mode:$('mode').value,firstPlayer:Number($('first-seat').value),seed:Number($('seed').value)});load({format:FORMAT,version:1,history:[{state:s,label:'Started original USA journey'}],index:0});message('New journey ready.');});};
$('reveal').onclick=()=>{revealed=!revealed;if(!revealed){stop();$('analysis-status').textContent='Private advice concealed.';}renderPrivate();renderActions();};
$('confirm').onclick=()=>safe(()=>{if(!selected)throw Error('Select an action');commit(applyAction(state,selected),selected.type==='keepTickets'?`Seat ${state.turn+1} kept ${selected.keep.length} destination tickets`:label(selected));message('Action recorded.');});
$('cancel-preview').onclick=()=>{selected=null;$('confirm').disabled=true;$('action-preview').textContent='Preview cancelled. Record unchanged.';};
for(const [id,delta]of [['undo',-1],['redo',1]])$(id).onclick=()=>{index=Math.max(0,Math.min(history.length-1,index+delta));state=history[index].state;revealed=false;selected=null;stop();save();render();};
$('live').onclick=()=>{index=history.length-1;state=history[index].state;revealed=false;stop();save();render();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:FORMAT,version:1,history,index,seats:state.players.map(()=> 'human')},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ticket-to-ride-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('import').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());load(data);message('Session imported. Private cards concealed.');}catch(error){message(`Import rejected: ${error.message}`);}e.target.value='';};
for(const [id,type]of [['correct','correction'],['adjudicate','recordAdjudication']])$(id).onclick=()=>safe(()=>commit(recordObservation(state,{type,state:JSON.parse($('corrected-state').value),reason:$('correction-reason').value,evidence:$('correction-reason').value,policyId:$('policy-id').value}),type==='correction'?'Recorded physical correction':'Recorded table adjudication'));
$('analyze').onclick=()=>safe(()=>{
 if(!revealed)throw Error('Reveal the active seat before requesting private advice');const blocker=analysisBlocker(state);if(blocker)throw Error(blocker);
 stop();if(!worker){worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.generation!==generation||!revealed)return;if(data.type==='error'){message(data.message);return;}
  $('analysis-status').textContent=`${data.iterations} samples · ${data.rootCoverage}/${data.candidates} root actions · ${data.pruned} pruned · ${data.paused?'paused':'running'}`;
  $('recommendations').replaceChildren();for(const row of data.rows.filter(r=>r.samples).slice(0,5)){const b=document.createElement('button');b.textContent=`Evaluation ${row.utility.toFixed(2)} · ${label(row.action)}`;b.onclick=()=>choose(row.action);b.title='Preview this recommendation; confirm separately to record';$('recommendations').append(b);}};}
 worker.postMessage({type:'start',generation,observation:publicObservation(state,state.turn),actions:legalActions(state),seed:1,iterationLimit:Math.max(100,legalActions(state).length*4)});
});
$('pause').onclick=()=>worker?.postMessage({type:'pause',generation});$('resume').onclick=()=>worker?.postMessage({type:'resume',generation,iterationLimit:100000});
try{const saved=localStorage.getItem(KEY);if(saved)load(JSON.parse(saved));else load({format:FORMAT,version:1,history:[{state:newGame(),label:'Started original USA physical journey'}],index:0});}catch(error){message(`Saved session rejected: ${error.message}`);load({format:FORMAT,version:1,history:[{state:newGame(),label:'New physical journey after rejected save'}],index:0});}
