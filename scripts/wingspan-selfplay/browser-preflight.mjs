import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {ROOT,read,atomic} from './common.mjs';
import {diagnosticPositions} from '../wingspan-study/fixtures.mjs';
import {publicObservation} from '../../wingspan/core.js';
const {chromium}=await import(process.env.WINGSPAN_PLAYWRIGHT_MODULE??'playwright');
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split(/=(.*)/s).slice(0,2)));
if(!args.models||!args.out)throw Error('Use --models=DIR --out=DIR');const models=resolve(args.models),out=resolve(args.out);
const fixtures=diagnosticPositions().map(f=>{const viewer=f.state.phase==='power'?f.state.pending[0].owner:f.state.currentPlayer;return {id:f.id,viewer,observation:publicObservation(f.state,viewer)};});
const server=createServer((req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Neural evaluator verification</title>');return;}
 if(path==='/models/fixtures.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtures));return;}
 let p;if(['/models/model.json','/models/zero-model.json','/models/parity.json'].includes(path))p=resolve(models,path.slice('/models/'.length));else{p=resolve(ROOT,'.'+decodeURIComponent(path));const rel=relative(ROOT,p);if(rel.startsWith('..')||isAbsolute(rel)||!['.js','.mjs','.json'].includes(extname(p)))throw Error('Path blocked');}
 res.setHeader('Content-Type',extname(p)==='.json'?'application/json':'application/javascript');res.end(readFileSync(p));
}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));let browser;
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'chrome'});const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const api=await import('/scripts/wingspan-selfplay/inference.mjs'),fixtures=await(await fetch('/models/fixtures.json')).json(),parity=await(await fetch('/models/parity.json')).json(),report={};
  for(const key of ['model','zero-model']){if(!Array.isArray(parity.cases)||parity.cases.length<1)throw Error('Missing browser parity cases');const model=api.compileModel(await(await fetch('/models/'+key+'.json')).json());let maxError=0;for(const c of parity.cases){const p=api.predictFeatures(model,c.features);if(!Number.isFinite((key==='zero-model'?0:c.expected))||!Number.isFinite(p))throw Error('Invalid browser parity value');maxError=Math.max(maxError,Math.abs(p-(key==='zero-model'?0:c.expected)));}if(maxError>.001)throw Error('Browser parity error '+maxError);
   const times=[];for(const f of fixtures){for(let n=0;n<3;n++)api.predictObservation(model,f.observation,f.viewer);for(let n=0;n<10;n++){const a=performance.now();api.predictObservation(model,f.observation,f.viewer);times.push(performance.now()-a);}}
   times.sort((a,b)=>a-b);const p95=times[Math.ceil(times.length*.95)-1];if(p95>20)throw Error('Browser inference p95 exceeds20ms');report[key]={maxError,fixtures:parity.cases.length,n:times.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:p95};
  }return report;
 });
 atomic(resolve(out,'browser-preflight.json'),{status:'passed',createdAt:new Date().toISOString(),viewport:'390x844 touch Chromium',realIPadSafari:false,results:result});console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
