/** Separately written arithmetic oracle. Reads pinned factual data, never rules helpers. */
import fs from 'node:fs';import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync(new URL('../seven-wonders-duel/reference-data.json',import.meta.url))),C=data.cards,W=data.wonders;
const n=(p,k)=>k==='wonders'?p.built.length:k==='treasury'?Math.trunc(p.coins/3):p.cards.filter(id=>C[id].color===k).length;
export function referencePayment(s,who,c,free=false){const p=s.players[who];if(free||(c.chain&&p.cards.includes(c.chain)))return{total:0,trade:0};
 let need=[...c.cost],choices=[],prices=[2,2,2,2,2];for(const id of s.players[1-who].cards){const x=C[id];if(x.color==='brown'||x.color==='grey')x.produce?.forEach((v,i)=>prices[i]+=v);}
 for(const x of [...p.cards.map(id=>C[id]),...p.built.map(id=>W[id])]){x.produce?.forEach((v,i)=>need[i]-=v);if(x.choice)choices.push(x.choice);for(const i of x.discount??[])prices[i]=1;}need=need.map(x=>Math.max(x,0));
 let best=Infinity;const reductions=(!c.color&&p.progress.includes('architecture'))||(c.color==='blue'&&p.progress.includes('masonry'))?2:0;
 function rebate(a,left){if(!left){best=Math.min(best,a.reduce((sum,v,i)=>sum+v*prices[i],0));return;}rebate(a,0);for(let i=0;i<5;i++)if(a[i]){const b=[...a];b[i]--;rebate(b,left-1);}}
 function wild(a,j){if(j===choices.length){rebate(a,reductions);return;}wild(a,j+1);for(const i of choices[j])if(a[i]){const b=[...a];b[i]--;wild(b,j+1);}}
 wild(need,0);return{trade:best,total:best+c.coins};}
export function referenceScore(s,who){const p=s.players[who],q=s.players[1-who];let total=Math.trunc(p.coins/3),blue=0;for(const id of p.cards){const c=C[id];if(c.guild)total+=(c.rate??1)*Math.max(...[p,q].map(x=>c.guild.reduce((sum,k)=>sum+n(x,k),0)));else{total+=c.points;if(c.color==='blue')blue+=c.points;}}
 for(const id of p.built)total+=W[id].points;for(const id of p.progress){if(id==='agriculture')total+=4;if(id==='philosophy')total+=7;if(id==='mathematics')total+=3*p.progress.length;}
 const m=s.military*(who? -1:1);total+=m>=6?10:m>=3?5:m>=1?2:0;return{total,blue};}
export function referenceTransition(before,a,after){const who=before.currentPlayer,other=1-who,p=before.players[who],q=before.players[other];let money=[p.coins,q.coins],military=before.military,looted=[...before.looted],expectedCards=[...p.cards],expectedBuilt=[...p.built];
 let c,pay={trade:0,total:0};if(a.type==='build'){c=C[before.board[a.slot].id];pay=referencePayment(before,who,c);expectedCards.push(c.id);}if(a.type==='recover'){c=C[a.id];expectedCards.push(c.id);}if(a.type==='wonder'){c=W[a.id];pay=referencePayment(before,who,c);expectedBuilt.push(c.id);}
 if(c){money[0]-=pay.total;if(q.progress.includes('economy'))money[1]+=pay.trade;money[0]+=c.gain??0;if(a.type==='build'&&c.chain&&p.cards.includes(c.chain)&&p.progress.includes('urbanism'))money[0]+=4;
  const virtual={...p,cards:expectedCards,built:expectedBuilt};if(c.per)money[0]+=(c.rate??1)*n(virtual,c.per);if(c.guild&&!['wonders','treasury'].includes(c.guild[0]))money[0]+=Math.max(...[virtual,q].map(x=>c.guild.reduce((sum,k)=>sum+n(x,k),0)));
  money[1]=Math.max(0,money[1]-(c.loot??0));if(c.shields){const shields=c.shields+(a.type!=='wonder'&&p.progress.includes('strategy')?1:0),sign=who? -1:1;military=Math.max(-9,Math.min(9,military+sign*shields));for(const [at,loss] of [[3,2],[6,5]])if(military*sign>=at&&!looted.includes(sign*at)){looted.push(sign*at);money[1]=Math.max(0,money[1]-loss);}}
 }else if(a.type==='discard')money[0]+=2+n(p,'yellow');else if(a.type==='progress'||a.type==='library'){if(['agriculture','urbanism'].includes(a.id))money[0]+=6;}
 assert.deepEqual(after.players.map(x=>x.coins),who?money.reverse():money,`coins for ${JSON.stringify(a)}`);assert.equal(after.military,military);assert.deepEqual(after.looted,looted);assert.deepEqual(after.players[who].cards,expectedCards);assert.deepEqual(after.players[who].built,expectedBuilt);
 if(['build','discard','wonder'].includes(a.type)){assert.equal(after.turn,before.turn+1);assert.equal(after.board[a.slot].removed,true);assert.equal(after.board[a.slot].id,null);}else assert.equal(after.turn,before.turn);
 if(a.type==='destroy')assert.ok(after.discard.includes(a.id));if(a.type==='recover')assert.ok(!after.discard.includes(a.id));
}
