import {TYPE_IDS,typeOf} from './catalog.js';
export function choices(hand,tableau,{unknown=false}={}){
 const available=hand.reduce((a,id)=>{const t=unknown?id:typeOf(id);a[t??'?']=(a[t??'?']??0)+1;return a;},{}),wild=available['?']??0;
 const types=TYPE_IDS.filter(t=>(available[t]??0)>0||wild>0),moves=types.map(t=>({cards:[t],returnId:null}));
 if(hand.length<2)return moves;
 const old=tableau.filter(e=>typeOf(e.id)==='chopsticks').map(e=>e.id);
 for(const returnId of old)for(const a of types)for(const b of types){const need=(available[a]??0)>=1?0:1;const other=(available[b]??0)-(a===b?1:0);if(need+(other>=1?0:1)<=wild)moves.push({cards:[a,b],returnId});}
 return moves;
}
export const choiceKey=a=>JSON.stringify([a.cards,a.returnId??null]);
export const choiceLabel=a=>a.cards.join(' → ')+(a.returnId?' · return chopsticks':'');
