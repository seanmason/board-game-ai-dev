import {COLORS,CARDS} from './catalog.js';
export function expeditionScore(ids){
 if(!ids.length)return {started:false,sum:0,wagers:0,multiplier:1,cost:0,bonus:0,total:0,count:0};
 const sum=ids.reduce((n,id)=>n+CARDS[id].value,0),wagers=ids.filter(id=>!CARDS[id].value).length,multiplier=wagers+1,bonus=ids.length>=8?20:0;
 return {started:true,sum,wagers,multiplier,cost:20,bonus,total:(sum-20)*multiplier+bonus,count:ids.length};
}
export function roundScore(s){return s.expeditions.map(columns=>{const parts=Object.fromEntries(COLORS.map(c=>[c,expeditionScore(columns[c])]));return {parts,total:Object.values(parts).reduce((n,p)=>n+p.total,0)};});}
export const score=s=>roundScore(s).map(p=>p.total);
