import {sum} from './catalog.js';
export function score(s){const herds=s.players.map(p=>p.herd),camel=herds.some(h=>h===null)?null:herds[0]===herds[1]?-1:herds[0]>herds[1]?0:1;
 const totals=s.players.map((p,i)=>p.bonuses.some(t=>t.value===null)||camel===null?null:sum(p.goods)+sum(p.bonuses.map(t=>t.value))+(camel===i?5:0));
 let winner=null;if(totals.every(n=>n!==null)){if(totals[0]!==totals[1])winner=totals[0]>totals[1]?0:1;else{for(const field of ['bonuses','goods']){const n=s.players.map(p=>p[field].length);if(n[0]!==n[1]){winner=n[0]>n[1]?0:1;break;}}}}
 return {totals,camel,winner,roundAdjudicationRequired:totals.every(n=>n!==null)&&winner===null};
}
export function outcome(s){return s.phase==='gameover'?{winner:s.winner,shares:[s.winner===0?1:0,s.winner===1?1:0]}:null;}
