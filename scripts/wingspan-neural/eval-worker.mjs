import {parentPort} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compileModel} from './inference.mjs';
import {play} from './game.mjs';
const dir=process.env.WINGSPAN_NEURAL_MODEL_DIR,models={},modelIds={};
for(const [key,file]of [['neural','mlp.json'],['linear','linear.json']]){
 const b=readFileSync(resolve(dir,file)),h=createHash('sha256').update(b).digest('hex');if(h!==process.env['WINGSPAN_NEURAL_'+key.toUpperCase()+'_SHA'])throw Error('Model bytes differ');
 models[key]=compileModel({...JSON.parse(b),id:h});modelIds[key]=h;
}
parentPort.on('message',({task,deadline})=>parentPort.postMessage(play(task,{models,modelIds,deadlineEpochMs:deadline})));
