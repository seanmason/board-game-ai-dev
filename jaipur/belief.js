import {CARD_TOTALS,DIGITAL_AUDIT,BONUS_TOKENS,sum} from './catalog.js';
/** Conservative residual card pool. Exact bonus sampling is intentionally gated.
 * A midgame unknown hand has no claimed calibrated distribution. */
export function residualCards(o){const remaining=[...CARD_TOTALS];o.market.forEach(k=>remaining[k]--);o.discard.forEach((n,k)=>remaining[k]-=n);for(const p of o.players){if(p.hand)p.hand.forEach((n,k)=>remaining[k]-=n);if(p.herd!==null)remaining[6]-=p.herd;}if(remaining.some(n=>n<0))throw Error('Impossible observations');return remaining;}
export function bonusRange(group){return [[1,3],[4,6],[8,10]][group];}
export function sampleBonus(o,group,random=Math.random){if(o?.audit!==DIGITAL_AUDIT)throw Error('Physical bonus distributions are not certified; enter actual physical values.');if(!o.bonusSupply[group])return null;const values=[...BONUS_TOKENS[group]];for(const p of o.players)for(const t of p.bonuses)if(t.group===group&&t.value!==null){const i=values.indexOf(t.value);if(i<0)throw Error('Bonus observations conflict with assumed inventory');values.splice(i,1);}return values[Math.min(values.length-1,Math.floor(random()*values.length))];}
export function unresolvedCardCount(o){return sum(residualCards(o));}
