import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','test/carcassonne.test.js'],{stdio:'inherit'});process.exitCode=result.status??1;
