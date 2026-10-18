import {pathToFileURL} from 'node:url';
import {runGame} from './benchmark-adapters/lost-cities.mjs';
export {runGame,metadata} from './benchmark-adapters/lost-cities.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await runGame(process.argv[2]?JSON.parse(process.argv[2]):{}),null,2));
