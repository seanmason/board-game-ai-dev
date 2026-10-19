/** Isolated research collection actor. No production policy changes. */
import {performance} from 'node:perf_hooks';
import {publicObservation,seededRandom,applyAction,ROUND_ACTIONS} from '../../wingspan/core.js';
import {candidateActions} from '../../wingspan/actions.js';
import {determinize} from '../../wingspan/belief.js';
import {chooseAction as searchedAction,activePlayer,normalizeArm} from '../wingspan-selfplay/game.mjs';
import {compileModel,predictObservation} from '../wingspan-selfplay/inference.mjs';
import {relativeScore,policyGrade,supportedModelObservation,usesLearnedValue} from '../wingspan-selfplay/rollout.mjs';

export function normalizeGenerator(task){
 const generator=task.generator??'baseline',cheapProbability=task.cheapProbability??.8;
 if(!['baseline','hybrid'].includes(generator))throw Error('Invalid collection generator');
 if(!Number.isFinite(cheapProbability)||cheapProbability<0||cheapProbability>1)throw Error('Invalid cheap probability');
 if(task.policySeed!==undefined&&(!Number.isSafeInteger(task.policySeed)||task.policySeed<0||task.policySeed>0xffffffff))throw Error('Invalid policy seed');
 return {generator,cheapProbability,policySeed:(task.policySeed??((task.seed^0xd1b54a35)>>>0))>>>0};
}
const boundary=s=>['play','gameover'].includes(s.phase)&&!s.pending.length&&!s.turnContext;
function priorChoices(state,choices){return choices.map(c=>({...c,grade:policyGrade(state,c.action,activePlayer(state))})).sort((a,b)=>b.grade-a.grade);}

/** One sampled belief per root; root main action counts as h1. Settle powers,
 * never begin the next main action. Existing search h4 counts FOUR subsequent
 * main actions in addition to its root; this actor preserves that baseline. */
export function chooseCheapAction(state,arm,options={}){
 arm=normalizeArm(arm);
 const {seed=1,step=1,models={},clock=()=>performance.now(),explorationRng,exploration}=options;
 const started=clock(),actor=activePlayer(state),observation=publicObservation(state,actor),choices=candidateActions(state);
 if(!choices.length)throw Error('No legal representative choices');
 const generated=clock(),diagnostics={rolloutCount:0,learnedLeafCount:0,learnedFallbackCount:0,settledLeaves:0,unsettledLeaves:0,safetyCapCount:0,rootTransitions:0,powerSteps:0,actionTurns:0,steps:0,determinizationMs:0,transitionMs:0,evaluationMs:0,generationMs:0};
 // Learned endpoints do not support power observations. Preserve existing prior
 // ordering there; report zero learned evaluations and zero imagined transitions.
 if(state.phase==='power'){
  const candidates=priorChoices(observation,choices).map(({grade,...c})=>({...c,visits:0,sum:grade,variance:0}));
  const finished=clock();return {action:candidates[0].action,summary:{candidates,diagnostics,method:'prior',horizon:0},elapsedMs:finished-started,generationMs:generated-started,searchMs:finished-generated,roots:choices.length,iterations:0,unvisited:0,explored:false,selectedVisits:0,floorOverrun:false,actorMode:'cheap-prior',oneStepEvaluations:0};
 }
 if(state.phase!=='play')throw Error('Cheap actor requires main action or power phase');
 const model=arm.method==='residual'?compileModel(models[arm.modelId]):undefined,rng=seededRandom((seed^Math.imul(step,193)^Math.imul(actor+1,982451653))>>>0);
 const allowModel=arm.method==='residual'&&supportedModelObservation(observation,actor),valueOptions={method:arm.method,model,allowModel};
 const initialLearnedMargin=allowModel?predictObservation(model,observation,actor):undefined;
 const candidates=choices.map(choice=>{
  let tick=clock();const initial=determinize(observation,rng);diagnostics.determinizationMs+=clock()-tick;
  tick=clock();const before=relativeScore(initial,actor,{...valueOptions,learnedMargin:initialLearnedMargin});diagnostics.evaluationMs+=clock()-tick;
  tick=clock();let leaf=applyAction(initial,choice.action);diagnostics.transitionMs+=clock()-tick;diagnostics.rootTransitions++;diagnostics.actionTurns++;
  let steps=0;
  while(!boundary(leaf)&&steps<192){
   tick=clock();const nextChoices=priorChoices(leaf,candidateActions(leaf));diagnostics.generationMs+=clock()-tick;
   if(!nextChoices.length)throw Error('No power choices while settling cheap successor');
   let next;tick=clock();for(const c of nextChoices){try{next=applyAction(leaf,c.action);break;}catch{}}
   if(!next)throw Error('No legal power choice while settling cheap successor');
   diagnostics.transitionMs+=clock()-tick;diagnostics.powerSteps+=Number(leaf.phase==='power');leaf=next;steps++;
  }
  const settled=boundary(leaf);diagnostics.steps+=steps;diagnostics.settledLeaves+=Number(settled);diagnostics.unsettledLeaves+=Number(!settled);diagnostics.safetyCapCount+=Number(!settled);
  if(!settled)throw Error('Cheap successor power settlement cap');
  tick=clock();const delta=relativeScore(leaf,actor,valueOptions)-before;diagnostics.evaluationMs+=clock()-tick;
  const learned=Number(usesLearnedValue(leaf,valueOptions));diagnostics.learnedLeafCount+=learned;diagnostics.learnedFallbackCount+=Number(arm.method==='residual'&&!learned);diagnostics.rolloutCount++;
  return {...choice,visits:1,sum:.82*delta+.18*policyGrade(initial,choice.action,actor),variance:0};
 }).sort((a,b)=>b.sum-a.sum);
 let selected=candidates[0],explored=false;
 if(exploration&&explorationRng&&ROUND_ACTIONS[state.round-1]-state.remaining[actor]<exploration.earlyActionsPerRound){
  const best=selected.sum,eligible=candidates.filter(c=>best-c.sum<=exploration.safetyMargin),weights=eligible.map(c=>Math.exp((c.sum-best)/exploration.temperature));
  let target=explorationRng()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<eligible.length;i++){target-=weights[i];if(target<=0){selected=eligible[i];break;}}
  explored=selected!==candidates[0];
 }
 const finished=clock();return {action:selected.action,summary:{candidates,diagnostics,method:arm.method,modelId:model?.id??null,horizon:1,horizonConvention:'root-action-inclusive',iterations:choices.length},elapsedMs:finished-started,generationMs:generated-started,searchMs:finished-generated,roots:choices.length,iterations:choices.length,unvisited:0,explored,selectedVisits:1,floorOverrun:false,actorMode:'cheap-successor',oneStepEvaluations:choices.length};
}

export function createActor(task){
 const config=normalizeGenerator(task),policyRng=seededRandom(config.policySeed);
 return (state,arm,options)=>{
  // Setup is held fixed; policy draws are separate from search/budget/exploration.
  const cheap=config.generator==='hybrid'&&state.phase!=='setup'&&policyRng()<config.cheapProbability;
  const result=cheap?chooseCheapAction(state,arm,options):searchedAction(state,arm,options);
  return {...result,generator:config.generator,actorMode:result.actorMode??'searched',oneStepEvaluations:result.oneStepEvaluations??0};
 };
}
