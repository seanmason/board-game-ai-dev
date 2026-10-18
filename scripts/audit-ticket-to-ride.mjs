import assert from 'node:assert/strict';
import {CITIES,ROUTES,TICKETS,CATALOG_GATES,COLORS} from '../ticket-to-ride/catalog.js';
const cities=new Set(CITIES.map(c=>c.id));assert.equal(cities.size,36);assert.equal(ROUTES.length,100);assert.equal(TICKETS.length,30);
assert.equal(new Set(ROUTES.map(r=>r.id)).size,100);assert.equal(new Set(TICKETS.map(t=>t.id)).size,30);
for(const r of ROUTES){assert.ok(cities.has(r.a)&&cities.has(r.b)&&r.a!==r.b);assert.ok(Number.isInteger(r.length)&&r.length>=1&&r.length<=6);assert.ok([...COLORS,'gray'].includes(r.color));assert.ok(r.sourceLocation);}
for(const t of TICKETS){assert.ok(cities.has(t.a)&&cities.has(t.b)&&t.a!==t.b);assert.ok(Number.isInteger(t.value)&&t.value>0);assert.ok(t.sourceLocation);}
for(const g of new Set(ROUTES.map(r=>r.parallelGroup).filter(Boolean))){const lanes=ROUTES.filter(r=>r.parallelGroup===g);assert.equal(lanes.length,2);assert.equal(lanes[0].length,lanes[1].length);}
const reached=new Set([CITIES[0].id]);for(let i=0;i<CITIES.length;i++)for(const r of ROUTES){if(reached.has(r.a))reached.add(r.b);if(reached.has(r.b))reached.add(r.a);}assert.equal(reached.size,36);
console.log(JSON.stringify({structuralAudit:'passed',cities:36,lanes:100,parallelGroups:new Set(ROUTES.map(r=>r.parallelGroup).filter(Boolean)).size,tickets:30,gates:CATALOG_GATES,limitation:'Ticket values remain a single visual transcription; structural checks do not certify component fidelity.'},null,2));
