import assert from 'node:assert/strict';
import {newGame,legalActions,applyAction,assertValid,outcome} from '../ticket-to-ride/core.js';
const results=[];
for(const players of [2,3,4,5]){
 let s=newGame({players,mode:'digital',seed:100+players}),steps=0;
 while(!['terminal','supplyAdjudication'].includes(s.phase)&&steps<1500){
  const a=legalActions(s);assert.ok(a.length);const claims=a.filter(a=>a.type==='claim');
  const action=claims.sort((a,b)=>(b.payment.count+b.payment.locomotive)-(a.payment.count+a.payment.locomotive))[0]||a.find(a=>a.type==='keepTickets')||a.find(a=>a.source==='blind')||a[0];
  s=applyAction(s,action);assertValid(s);steps++;
 }
 const result=outcome(s);if(result?.complete)assert.ok(Math.abs(result.shares.reduce((a,b)=>a+b,0)-1)<1e-10);
 results.push({players,steps,status:s.phase,complete:Boolean(result?.complete),reason:s.pending?.reason||null});
}
assert.ok(results.every(r=>r.status==='terminal'),'Screening transcripts must complete rather than treating caps/adjudication as draws');
console.log(JSON.stringify({method:'Deterministic longest-legal-claim conservation screen; not strength evidence',results},null,2));
