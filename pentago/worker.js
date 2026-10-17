import {createSearch,runSearch,searchSummary,advanceSearch} from "./ai.js";
import {seededRandom} from "./core.js";

let currentGeneration=0,search=null,running=false,scheduled=null;
let activeStart=0,activeMs=0,lastReport=0,batch=3;
let reused=false,retained=0,retainedNodes=0;
const now=()=>performance.now();
const elapsed=()=>activeMs+(running?now()-activeStart:0);
function send(){
  if(!search)return;
  self.postMessage({
    type:"progress",generation:currentGeneration,elapsedMs:elapsed(),
    paused:!running,reused,retainedVisits:retained,retainedNodes,
    ...searchSummary(search)
  });
}
function stop(){
  if(running)activeMs+=now()-activeStart;
  running=false;
  if(scheduled!==null)clearTimeout(scheduled);
  scheduled=null;
}
function tick(){
  if(!running||scheduled!==null)return;
  scheduled=setTimeout(()=>{
    scheduled=null;
    if(!running)return;
    try{
      runSearch(search,batch);
      if(now()-lastReport>=500){send();lastReport=now();}
    }catch(error){
      stop();
      self.postMessage({type:"error",generation:currentGeneration,
        message:error.message});
      return;
    }
    tick();
  },0);
}
function pause(){
  stop();
  send();
}
function resume(){
  if(!search||running)return;
  activeStart=now();running=true;lastReport=now();
  send();tick();
}
self.onmessage=event=>{
  const data=event.data;
  if(data.type==="start"){
    stop();
    currentGeneration=data.generation;
    search=createSearch(data.state,{
      rng:seededRandom(data.seed),maxNodes:data.maxNodes??14000,
      rolloutLength:data.rolloutLength??10
    });
    batch=data.batch??3;
    reused=false;retained=0;retainedNodes=0;activeMs=0;
    if(data.running!==false)resume();else send();
    return;
  }
  if(data.type==="advance"){
    if(data.previousGeneration!==currentGeneration)return;
    stop();
    const rng=search?.rng??seededRandom(data.seed);
    const result=search&&advanceSearch(search,data.action,data.state);
    currentGeneration=data.generation;
    reused=!!result?.reused;
    retained=reused?result.retainedVisits:0;
    retainedNodes=reused?result.retainedNodes:0;
    if(!reused)search=createSearch(data.state,{rng,
      maxNodes:data.maxNodes??14000,rolloutLength:data.rolloutLength??10});
    activeMs=0;
    if(data.running)resume();else send();
    return;
  }
  if(data.generation!==currentGeneration)return;
  if(data.type==="pause")pause();
  else if(data.type==="resume")resume();
  else if(data.type==="stop"){stop();search=null;}
  else if(data.type==="snapshot")send();
};
