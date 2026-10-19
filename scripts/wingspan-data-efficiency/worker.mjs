import {parentPort} from 'node:worker_threads';
import {read} from '../wingspan-selfplay/common.mjs';
import {collectGame} from './collect.mjs';
import {play} from './game.mjs';
parentPort.on('message',({task,deadlineEpochMs=Infinity})=>{
 const cpu=process.cpuUsage();
 try{
  const models=Object.fromEntries(Object.entries(task.modelPaths??{}).map(([id,path])=>[id,read(path)]));
  if(Date.now()>=deadlineEpochMs)throw Error('deadline before game');
  const record=task.kind==='collect'?collectGame(task,{models,deadlineEpochMs}):(()=>{const result=play(task,{models,deadlineEpochMs});return {task,result,validation:result.validation,elapsedMs:result.elapsedMs};})();
  record.processCpuMicros=process.cpuUsage(cpu);parentPort.postMessage(record);
 }catch(e){parentPort.postMessage({task,generator:task.generator,status:'failed',validation:{valid:false,issues:[e.stack]},elapsedMs:0,processCpuMicros:process.cpuUsage(cpu)});}
});
