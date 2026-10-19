/** Bounded payment-only profile. No games, search, training, or source mutation.
 * node payment-profile.mjs --legacy-root <untouched-checkout> [--output <receipt>]
 * Keep receipts outside Git. The legacy high-stock case is deliberately omitted.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {findFoodPayment} from '../../wingspan/core.js';
import {BIRDS} from '../../wingspan/catalog.js';
import {FOOD} from '../../wingspan/scoring.js';
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const legacyRoot=option('--legacy-root');
if(!legacyRoot)throw Error('Supply --legacy-root pointing to an untouched pre-repair checkout');
const legacyPath=path.resolve(legacyRoot,'wingspan/core.js');
const legacy=await import(pathToFileURL(legacyPath).href);
const bird=BIRDS.find(b=>!b.either&&b.food.fish===3&&Object.values(b.food).reduce((a,b)=>a+b,0)===3);
const food=n=>Object.fromEntries(FOOD.map(f=>[f,f==='seed'?n:0]));
const run=(fn,n)=>{const start=performance.now(),payment=fn(food(n),bird);return {seedTokens:n,elapsedMs:performance.now()-start,payment};};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const currentPath=fileURLToPath(new URL('../../wingspan/core.js',import.meta.url));
const receipt={version:1,kind:'food-payment-only',createdAt:new Date().toISOString(),node:process.version,
 hardware:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length},
 source:{current:currentPath,currentHash:hash(currentPath),legacy:legacyPath,legacyHash:hash(legacyPath)},
 bird:{id:bird.id,name:bird.name},cases:[],limit:'Legacy measured only through 24 identical seeds; no claimed worst-case timing.'};
for(const n of [12,18,24]){
 const before=run(legacy.findFoodPayment,n),after=run(findFoodPayment,n);
 if(JSON.stringify(before.payment)!==JSON.stringify(after.payment))throw Error('Payment mismatch');
 receipt.cases.push({before,after});
}
receipt.correctedLargeStock=run(findFoodPayment,10000);
const result=JSON.stringify(receipt,null,2),output=option('--output');
if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output+'.tmp',result);fs.renameSync(output+'.tmp',output);}
console.log(result);
