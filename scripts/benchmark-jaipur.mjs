export {metadata,runGame,simulateMatch} from './benchmark-adapters/jaipur.mjs';
import {runGame} from './benchmark-adapters/jaipur.mjs';
import {pathToFileURL} from 'node:url';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runGame({seed:Number(process.argv[2]??1)}),null,2));
