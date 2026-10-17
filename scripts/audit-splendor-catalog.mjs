import assert from 'node:assert/strict';
import {CARDS,NOBLES,COLORS} from '../splendor/catalog.js';
const sources={
 csv:'https://raw.githubusercontent.com/bouk/splendimax/5ffcb148ee0093e3b47f612b04a1927301ff13ee/Splendor%20Cards.csv',
 photo:'https://raw.githubusercontent.com/anicolao/splendor/5b3efd26f2e460b1bef3839a058270b536a13648/data/verified_card_properties.csv',
 second:'https://raw.githubusercontent.com/seal256/splendor/263abc066c563a1c89dba4bdc408446a20ad9d1d/assets/cards.csv',
 nobles:'https://raw.githubusercontent.com/seal256/splendor/263abc066c563a1c89dba4bdc408446a20ad9d1d/src/splendor.cpp'};
async function read(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Reference fetch failed '+r.status);return r.text();}
function csv(text){const [head,...rows]=text.trim().split(/\r?\n/).map(x=>x.split(','));return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]])));}
const key=c=>JSON.stringify([c.tier,c.bonus,c.points,c.cost]);
const canonical=CARDS.map(key).sort();const cs=COLORS.slice(0,5),codes=['w','b','g','r','k'];
const [a,b,c,n]=await Promise.all(Object.values(sources).map(read));
const first=csv(a).map(r=>({tier:+r.Level,bonus:cs.indexOf(r.Color.toLowerCase()),points:+r.PV,cost:cs.map(c=>+r[c[0].toUpperCase()+c.slice(1)])}));
const photographed=csv(b).map(r=>({tier:+r.id.split('-')[1].slice(1),bonus:cs.indexOf(r.id.split('-')[0]),points:+r.prestige_points,cost:cs.map(c=>+r[c])}));
const second=csv(c).map(r=>({tier:+r.level,bonus:codes.indexOf(r.gem),points:+r.points,cost:codes.map(c=>+r[c])}));
for(const [name,rows] of [['CSV',first],['photo',photographed],['second',second]])assert.deepEqual(rows.map(key).sort(),canonical,name+' mismatch');
const nobleStrings=[...n.split('NOBLES_STR =')[1].split(';')[0].matchAll(/\[3\|([rgbwk0-9]+)\]/g)];
const nobles=nobleStrings.map(m=>codes.map(c=>+(m[1].match(new RegExp(c+'(\\d)'))?.[1]??0)));
assert.deepEqual(nobles.map(JSON.stringify).sort(),NOBLES.map(n=>JSON.stringify(n.cost)).sort());
console.log(JSON.stringify({cards:90,cardReferences:3,nobles:10,differences:0,sources},null,2));
