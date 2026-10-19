/** External worker: the internal linear slot is the zero-output MLP control. */
import {parentPort} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),plan=JSON.parse(readFileSync(resolve(home,'plan.json'),'utf8'));
const {compileModel}=await import(pathToFileURL(resolve(plan.sourceRoot,'scripts/wingspan-neural/inference.mjs')));
const {play}=await import(pathToFileURL(resolve(plan.sourceRoot,'scripts/wingspan-neural/game.mjs')));
const models={},modelIds={};
for(const [key,file]of Object.entries(plan.modelFiles)){
 const bytes=readFileSync(resolve(home,file)),sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==plan.modelHashes[key])throw Error('Frozen model changed '+key);
 models[key]=compileModel({...JSON.parse(bytes),id:sha});modelIds[key]=sha;
}
parentPort.on('message',({task,deadline})=>{
 if(task.opponent?.modelRole!=='same-shape-zero-output-mlp-50-percent-blend'||task.candidate?.modelRole!=='real-selected-mlp-50-percent-blend')throw Error('Control role mismatch');
 parentPort.postMessage(play(task,{models,modelIds,deadlineEpochMs:deadline}));
});
