import {parentPort} from 'node:worker_threads';
import {play} from './game.mjs';
parentPort.on('message',({task,deadline})=>parentPort.postMessage(play(task,{deadlineEpochMs:deadline})));
