/** Readiness artifact only: no workers, processes or strength games are started. */
import {resolve} from 'node:path';
import {readFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ROOT,atomic,read,sourceHashes,digest} from './runtime.mjs';
import {snapshot} from './dashboard.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.out||!args.previous||!args.publication)throw Error('Use --out=DIR --previous=OLD_RUNTIME_ROOT --publication=EVIDENCE_WORKTREE');
const out=resolve(args.out),previous=resolve(args.previous),ownership=read(resolve(previous,'owned-processes.json'));
if(existsSync(resolve(out,'launch.json')))throw Error('Already launched; never overwrite readiness');
const changes=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:ROOT,encoding:'utf8'}).trim();if(changes)throw Error('Commit tracked source before preparing');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),hashes=sourceHashes(),previousStudy=resolve(previous,'study');
const config={version:1,preparedAt:new Date().toISOString(),root:ROOT,out,revision,hashes,node:process.execPath,workers:30,durationHours:9,previousStudy,previousRunnerPid:ownership.runnerPid,previousManifest:resolve(previousStudy,'manifest.json'),previousWrapper:ownership.runner,publicationRepo:resolve(args.publication),publicationBranch:'benchmarks/wingspan-overnight-2026-10-18',seedAudit:read(resolve(ROOT,'scripts/wingspan-overnight/seed-audit.json'))};
if(config.seedAudit.status!=='passed')throw Error('Seed audit must pass');
for(const key of ['previousManifest','previousWrapper'])config[key+'Hash']=digest(readFileSync(config[key]));
mkdirSync(out,{recursive:true});atomic(resolve(out,'ready.json'),config);copyFileSync(resolve(ROOT,'docs/work/wingspan-overnight-2026-10-18.md'),resolve(out,'protocol.md'));copyFileSync(resolve(ROOT,'scripts/wingspan-overnight/seed-audit.json'),resolve(out,'seed-audit.json'));
atomic(resolve(out,'checkpoint.json'),{revision,updatedAt:new Date().toISOString(),status:'planned',stage:'awaiting-approval',workers:30,planned:0,finished:0,active:[]});atomic(resolve(out,'dashboard.json'),snapshot({revision,startedAt:null}));
console.log(JSON.stringify({ready:resolve(out,'ready.json'),revision,sourceFiles:Object.keys(hashes).length,started:false}));
