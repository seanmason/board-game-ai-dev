import {createSearch,runSearch,searchSummary} from "./analysis.js";
import {seededRandom} from "./core.js";

let generation=0,search=null,active=false,scheduled=null,chunk=24;
let activeFrom=0,activeMilliseconds=0,reportedAt=0;
const now=()=>performance.now();
const elapsed=()=>activeMilliseconds+(active?now()-activeFrom:0);
function snapshot(){
  if(!search)return;
  self.postMessage({
    type:"progress",generation,elapsedMs:elapsed(),paused:!active,
    ...searchSummary(search)
  });
}
function stop(){
  if(active)activeMilliseconds+=now()-activeFrom;
  active=false;
  if(scheduled!==null)clearTimeout(scheduled);
  scheduled=null;
}
function tick(){
  if(!active||scheduled!==null)return;
  scheduled=setTimeout(()=>{
    scheduled=null;
    if(!active)return;
    try {runSearch(search,chunk);}
    catch(error){
      stop();
      self.postMessage({type:"error",generation,message:error.message});
      return;
    }
    if(now()-reportedAt>=450){snapshot();reportedAt=now();}
    tick();
  },0);
}
function resume(){
  if(!search||active)return;
  active=true;activeFrom=now();reportedAt=now();
  snapshot();tick();
}
self.onmessage=event=>{
  const data=event.data;
  if(data.type==="start"){
    stop();
    generation=data.generation;
    chunk=Math.max(1,Math.min(250,data.chunk??24));
    activeMilliseconds=0;
    try{
      search=createSearch(data.observation,data.actions,{
        rng:seededRandom(data.seed),exploration:data.exploration,
        method:data.method??"heuristic",horizon:data.horizon??4,
        leafEvaluator:data.leafEvaluator??"opening-plan"
      });
    }catch(error){
      search=null;
      self.postMessage({type:"error",generation,message:error.message});
      return;
    }
    if(data.running!==false)resume();else snapshot();
    return;
  }
  if(data.generation!==generation)return;
  if(data.type==="pause"){stop();snapshot();}
  else if(data.type==="resume")resume();
  else if(data.type==="stop"){stop();search=null;}
  else if(data.type==="snapshot")snapshot();
};
