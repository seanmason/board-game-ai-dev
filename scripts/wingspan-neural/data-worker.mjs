import {parentPort} from 'node:worker_threads';
import {collectGame} from './collect.mjs';
parentPort.on('message',({task,deadline})=>parentPort.postMessage({...collectGame(task,{deadlineEpochMs:deadline}),id:task.id}));
