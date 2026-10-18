import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['--test','test/hive.test.js'],{stdio:'inherit'});process.exitCode=r.status??1;
