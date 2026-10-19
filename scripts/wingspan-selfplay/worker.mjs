import {parentPort} from 'node:worker_threads';
import {spawnSync} from 'node:child_process';
import {read} from './common.mjs';
// Apply the worker thread's Windows scheduling priority, and fail closed if unavailable.
if(process.platform==='win32'){
 const priority=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',`$p=Get-Process -Id ${process.pid}; $p.PriorityClass='BelowNormal'; if($p.PriorityClass -ne 'BelowNormal'){exit 1}`],{windowsHide:true,encoding:'utf8'});
 if(priority.status!==0)throw Error('Cannot establish BelowNormal process priority: '+priority.stderr);
}
parentPort.on('message',async({task,deadlineEpochMs})=>{try{const models=Object.fromEntries(Object.entries(task.modelPaths??{}).map(([id,path])=>[id,read(path)]));if(Date.now()>=deadlineEpochMs)throw Error('deadline before game');if(task.kind==='collect'){const {collectGame}=await import('./collect.mjs');parentPort.postMessage(await collectGame(task,{models,deadlineEpochMs}));}else{const {play}=await import('./game.mjs');const result=await play(task,{models,deadlineEpochMs});parentPort.postMessage({task,result,validation:result.validation,elapsedMs:result.elapsedMs});}}catch(e){parentPort.postMessage({task,status:'failed',validation:{valid:false,issues:[e.stack]},elapsedMs:0});}});
