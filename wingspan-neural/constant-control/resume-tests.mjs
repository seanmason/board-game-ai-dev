import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {plannedIssues,makeValidator,originalClock,admitResume,assertOriginal} from './resume.mjs';
import {CONTROL,SOURCE,read,hash} from './support.mjs';
const plan=assertOriginal(),t=plan.tasks[0],record=structuredClone(t),scheduled={...t,startedAt:'transient-scheduler-time'};
assert.deepEqual(plannedIssues(plan,record,scheduled),[]);
for(const key of Object.keys(t)){const changed=structuredClone(record);changed[key]=null;assert(plannedIssues(plan,changed,scheduled).includes('frozen-task-'+key),key);const bad=structuredClone(scheduled);bad[key]=null;assert(plannedIssues(plan,record,bad).length,key);}
assert(plannedIssues(plan,{...record,purpose:'changed'},scheduled).includes('frozen-task-purpose'));
const {validateResult}=await import(pathToFileURL(resolve(SOURCE,'scripts/wingspan-neural/analyze.mjs')));
const validate=makeValidator(plan,validateResult),names=readdirSync(resolve(CONTROL,'results/games')).filter(x=>x.endsWith('.json'));assert.equal(names.length,1);
const r=read(resolve(CONTROL,'results/games',names[0])),rt=plan.tasks.find(t=>t.id===r.id);assert.deepEqual(validate(r,rt),[]);assert.deepEqual(validate(r,{...rt,startedAt:'temporary'}),[]);
const original=read(resolve(CONTROL,'execution-receipt.json')),clock=originalClock(original);assert.equal(clock.deadline-clock.started,900000);assert.throws(()=>originalClock({...original,deadline:new Date(Date.now()+900000).toISOString()}));
assert.throws(()=>admitResume(plan,clock.deadline,clock.deadline));const admitted=admitResume(plan,clock.deadline,clock.started);assert.equal(admitted.remainingTasks,63);assert.equal(admitted.deadline,original.deadline);
const result={status:'passed',tests:7,canonicalFieldsTested:Object.keys(t),retainedGame:r.id,retainedSha256:hash(readFileSync(resolve(CONTROL,'results/games',names[0]))),originalStartedAt:original.startedAt,originalDeadline:original.deadline,createdAt:new Date().toISOString(),gamesLaunched:0};
writeFileSync(resolve(CONTROL,'repair-resume-tests.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
