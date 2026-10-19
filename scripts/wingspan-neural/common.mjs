import {readFileSync,readdirSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function atomic(path,data){mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',JSON.stringify(data,null,2));for(let i=0;;i++){try{renameSync(path+'.tmp',path);return;}catch(e){if(!['EBUSY','EACCES','EPERM'].includes(e.code)||i===8)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*2**i);}}}
export function hashes({collection=false}={}){
 const paths=[];const walk=d=>{for(const e of readdirSync(resolve(ROOT,d),{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory())walk(p);else if(/\.(mjs|js|json|py)$/.test(p)&&!p.includes('__pycache__'))paths.push(p);}};
 for(const d of ['wingspan','scripts/wingspan-study'])walk(d);
 if(collection){for(const f of ['encoder','targets','collect','common','data-run','data-worker','plan'])paths.push('scripts/wingspan-neural/'+f+'.mjs');paths.push('scripts/wingspan-overnight/runtime.mjs');}
 else walk('scripts/wingspan-neural');
 return Object.fromEntries(paths.sort().map(p=>[p,hash(readFileSync(resolve(ROOT,p)))]));
}
export function guard(h){for(const[p,d]of Object.entries(h))if(hash(readFileSync(resolve(ROOT,p)))!==d)throw Error('Frozen source differs: '+p);}
