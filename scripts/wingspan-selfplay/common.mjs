import {readFileSync,readdirSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const read=path=>JSON.parse(readFileSync(path,'utf8'));
export function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export const objectHash=value=>hash(JSON.stringify(canonical(value)));
export function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2));renameSync(tmp,path);}
export function sourceHashes(){const files=[];function walk(dir){for(const e of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()&&e.name!=='__pycache__')walk(p);else if(/\.(mjs|js|json|py)$/.test(p))files.push(p);}}for(const d of ['wingspan','scripts/wingspan-study','scripts/wingspan-neural','scripts/wingspan-selfplay'])walk(d);return Object.fromEntries(files.sort().map(p=>[p,hash(readFileSync(resolve(ROOT,p)))]));}
export function guard(hashes){for(const [p,h] of Object.entries(hashes))if(hash(readFileSync(resolve(ROOT,p)))!==h)throw Error('Frozen source/model changed: '+p);}
// Scheduler metadata is deliberately excluded. Every other planned field is frozen.
export function frozenTask(task){return Object.fromEntries(Object.entries(task).filter(([k])=>!['startedAt','workerId','attempt','finishedAt'].includes(k)));}
export function validateRecord(record,task){const issues=[];if(objectHash(frozenTask(record.task??record))!==objectHash(frozenTask(task)))issues.push('task identity mismatch');const r=record.result??record;if(r.status!=='complete')issues.push('game not complete');const v=record.validation??r.validation;if(v?.valid!==true)issues.push('validation not valid');if(!Number.isFinite(record.elapsedMs??r.elapsedMs)||(record.elapsedMs??r.elapsedMs)<0)issues.push('invalid elapsed time');return issues;}
