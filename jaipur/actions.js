import {GOODS,PRECIOUS,zero,sum} from './catalog.js';
export function multisets(limits,min,max){const result=[],v=zero();function visit(i,n){if(i===6){if(n>=min&&n<=max)result.push([...v]);return;}for(let k=0;k<=Math.min(limits[i],max-n);k++){v[i]=k;visit(i+1,n+k);}}visit(0,0);return result;}
/** Enumerates all canonical exchanges, with no strategic pruning. */
export function enumerateActions(s,actor=s.currentPlayer){if(s.phase!=='turn'||actor!==s.currentPlayer)return [];const p=s.players[actor],market=zero();s.market.forEach(k=>{if(k<6)market[k]++;});const out=[];
 if(p.handSize<7)s.market.forEach((k,i)=>{if(k<6)out.push({type:'takeGood',marketSlot:i});});
 if(s.market.includes(6))out.push({type:'takeCamels'});
 const limits=p.hand??GOODS.map(()=>p.handSize);
 for(let g=0;g<6;g++)for(let n=PRECIOUS.has(g)?2:1;n<=limits[g];n++)out.push({type:'sell',good:g,count:n});
 for(const takeCounts of multisets(market,2,5)){const n=sum(takeCounts),payLimits=limits.map((k,g)=>takeCounts[g]?0:k);for(const giveGoods of multisets(payLimits,0,n)){const paid=sum(giveGoods),giveCamels=n-paid;if(giveCamels>(p.herd??11)||paid>p.handSize||p.handSize-paid+n>7)continue;out.push({type:'exchange',takeCounts,giveGoods,giveCamels});}}
 return out;
}
export function actionKey(a){if(Array.isArray(a))return `[${a.map(actionKey).join(',')}]`;if(a&&typeof a==='object')return `{${Object.keys(a).sort().map(k=>`${JSON.stringify(k)}:${actionKey(a[k])}`).join(',')}}`;return JSON.stringify(a);}
export function describe(a){if(a.type==='takeGood')return `Take market card ${a.marketSlot+1}`;if(a.type==='takeCamels')return 'Take all market camels';if(a.type==='sell')return `Sell ${a.count} ${GOODS[a.good]}`;return `Take ${a.takeCounts.map((n,i)=>n?`${n} ${GOODS[i]}`:'').filter(Boolean).join(', ')}; pay ${[...a.giveGoods.map((n,i)=>n?`${n} ${GOODS[i]}`:''),a.giveCamels?`${a.giveCamels} camels`:''].filter(Boolean).join(', ')}`;}
