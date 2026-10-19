/** Bounded outcome-blind latency gate, including raven stock substitution. */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setPriority,constants} from 'node:os';
import {diagnosticPositions} from '../wingspan-study/fixtures.mjs';
import {BIRDS} from '../../wingspan/catalog.js';
import {FOOD,HABITATS} from '../../wingspan/scoring.js';
import {applyAction,assertValid} from '../../wingspan/core.js';
import {candidateActions} from '../../wingspan/actions.js';
import {chooseAction} from './game.mjs';
export function doubleRavenFixture(){
 const s=diagnosticPositions().find(f=>f.id==='raven-late').state,p=s.players[0];
 const birds=[...s.deck,...s.tray,...s.birdDiscard,...s.players.flatMap(q=>[...q.hand,...HABITATS.flatMap(h=>q.habitats[h].flatMap(e=>[e.id,...e.tucked]))])];
 const ravens=BIRDS.filter(b=>b.powerCode===33&&b.habitats.includes('grassland')).slice(0,2),eagle=BIRDS.find(b=>b.powerCode===42&&b.habitats.includes('grassland'));
 if(ravens.length!==2||!eagle)throw Error('Missing raven fixture birds');
 const ids=[...ravens,eagle].map(b=>b.id);for(const q of s.players)for(const h of HABITATS)q.habitats[h]=[];
 p.habitats.grassland=ids.map(id=>({id,eggs:Math.min(2,BIRDS[id].eggs),cached:[],tucked:[]}));
 for(const q of s.players)q.hand=[];
 const remainder=birds.filter(id=>!ids.includes(id));p.hand=remainder.slice(0,3);s.tray=remainder.slice(3,6);s.deck=remainder.slice(6);s.birdDiscard=[];
 p.food=Object.fromEntries(FOOD.map((f,i)=>[f,i===0?60:0]));s.eggSupply=75-p.habitats.grassland.reduce((n,e)=>n+e.eggs,0);
 s.pending=[];s.turnContext=null;assertValid(s);
 let power=applyAction(s,candidateActions(s).find(a=>a.action.type==='layEggs').action);
 while(power.phase==='power'&&power.pending[0].code!==33)power=applyAction(power,{type:'power',skip:true});
 assertValid(power);return [{id:'double-raven-rich-stock-play',state:s},{id:'double-raven-rich-stock-power',state:power}];
}
export function profile({out}={}){
 setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
 const fixtures=[...diagnosticPositions().filter(f=>['repeat-raven','draw-tuck-forward'].includes(f.id)),...doubleRavenFixture()];
 const decisions=fixtures.map(({id,state})=>{const r=chooseAction(state,{method:'reference',budget:100,timeMs:1000},{seed:5318008});return {id,elapsedMs:r.elapsedMs,roots:r.roots,iterations:r.iterations,generationMs:r.generationMs,searchMs:r.searchMs,diagnostics:r.summary.diagnostics};});
 const times=decisions.map(d=>d.elapsedMs).sort((a,b)=>a-b),maxMs=times.at(-1),p99Ms=times[Math.ceil(times.length*.99)-1];
 const passed=p99Ms<=2000&&maxMs<=5000&&decisions.every(d=>d.diagnostics.safetyCapCount===0&&d.diagnostics.unsettledLeaves===0);
 const result={schema:1,status:passed?'passed':'failed',passed,at:new Date().toISOString(),latency:{p99Ms,maxMs},decisions,
  limits:{requestedMs:1000,p99Ms:2000,maxMs:5000},scope:'Four fixed adversarial desktop positions; not population tail evidence',productionStrengthClaim:false};
 if(out){mkdirSync(out,{recursive:true});const path=resolve(out,'profile.json');writeFileSync(path+'.tmp',JSON.stringify(result,null,2)+'\n');renameSync(path+'.tmp',path);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));const r=profile({out:args.out});console.log(JSON.stringify(r));if(!r.passed)process.exitCode=1;}
