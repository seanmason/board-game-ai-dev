import {CARDS,ALL_IDS,COLORS,cardType} from './catalog.js';
export function canPlay(column,id){const c=CARDS[id];if(!c)return false;const last=column.length?CARDS[column.at(-1)].value:0;return c.value===0?last===0:c.value>last;}
export function placements(hand,columns){
 const ids=hand.includes(null)?[...hand.filter(Boolean),...ALL_IDS]:hand,seen=new Set(),out=[];
 for(const id of ids){const t=cardType(id);if(seen.has(t))continue;seen.add(t);out.push({type:'discard',cardId:id});if(canPlay(columns[CARDS[id].color],id))out.push({type:'play',cardId:id});}return out;
}
export function drawChoices(tops,lastDiscard){return [{type:'draw',source:'deck'},...COLORS.filter(c=>tops[c]&&tops[c]!==lastDiscard).map(source=>({type:'draw',source}))];}
export const actionKey=a=>JSON.stringify([a.type,a.cardId??null,a.source??null,a.starter??null]);
