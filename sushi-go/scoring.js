import {TYPES,typeOf} from './catalog.js';
export const counts=types=>types.reduce((a,t)=>(a[t]=(a[t]??0)+1,a),{});
export function localScore(tableau){
 const c=counts(tableau.map(e=>typeOf(e.id)));let nigiri=0;
 for(const e of tableau){const t=TYPES[typeOf(e.id)];if(t.nigiri)nigiri+=t.nigiri*(e.wasabi?3:1);}
 const parts={tempura:Math.floor((c.tempura??0)/2)*5,sashimi:Math.floor((c.sashimi??0)/3)*10,dumpling:[0,1,3,6,10,15][Math.min(5,c.dumpling??0)],nigiri};
 return {...parts,total:Object.values(parts).reduce((a,b)=>a+b,0),makiIcons:tableau.reduce((a,e)=>a+(TYPES[typeOf(e.id)].maki??0),0)};
}
export function makiScore(icons){
 const result=icons.map(()=>0),first=Math.max(...icons);if(first===0)return result;
 const leaders=icons.flatMap((v,p)=>v===first?[p]:[]);for(const p of leaders)result[p]=Math.floor(6/leaders.length);if(leaders.length>1)return result;
 const second=Math.max(0,...icons.filter(v=>v<first));if(second===0)return result;const runners=icons.flatMap((v,p)=>v===second?[p]:[]);for(const p of runners)result[p]=Math.floor(3/runners.length);return result;
}
export function puddingScore(puddings){
 const result=puddings.map(()=>0),hi=Math.max(...puddings),lo=Math.min(...puddings);if(hi===lo)return result;
 const most=puddings.flatMap((v,p)=>v===hi?[p]:[]),least=puddings.flatMap((v,p)=>v===lo?[p]:[]);
 for(const p of most)result[p]=Math.floor(6/most.length);if(puddings.length>2)for(const p of least)result[p]=-Math.floor(6/least.length);return result;
}
export function roundScore(tableaux){const parts=tableaux.map(localScore),maki=makiScore(parts.map(p=>p.makiIcons));return parts.map((p,i)=>({...p,maki:maki[i],total:p.total+maki[i]}));}
export function winnersFor(scores,puddings){const best=Math.max(...scores),leaders=scores.flatMap((v,p)=>v===best?[p]:[]),dessert=Math.max(...leaders.map(p=>puddings[p]));return leaders.filter(p=>puddings[p]===dessert);}
