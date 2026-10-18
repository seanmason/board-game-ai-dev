/** Small predeclared blends of screened point corrections, without baseline. */
import {developmentAdjustments} from './development-evaluators.js';
import {efficiencyAdjustments} from './efficiency-evaluators.js';
export const FINAL_EVALUATORS=Object.freeze(['final-space-robust','final-space-saturation','final-robust-saturation','final-space-robust-saturation','final-development-options','final-cautious-portfolio']);
const cap=x=>Math.max(-4,Math.min(4,x));
export function finalAdjustments(state,player){
 if(state.phase==='gameover')return Object.fromEntries(FINAL_EVALUATORS.map(k=>[k,0]));
 const d=developmentAdjustments(state,player), e=efficiencyAdjustments(state,player);
 const slot=d['slot-scarcity'],robust=e['robust-value'],saturation=e['engine-saturation'];
 return {
  'final-space-robust':cap(.5*slot+.5*robust),
  'final-space-saturation':cap(.5*slot+.5*saturation),
  'final-robust-saturation':cap(.5*robust+.5*saturation),
  'final-space-robust-saturation':cap((slot+robust+saturation)/3),
  'final-development-options':cap(.35*slot+.35*d['bonus-card-option']+.3*d['grassland-foundation']),
  'final-cautious-portfolio':cap(.25*slot+.25*robust+.25*saturation+.25*e['tuck-card-opportunity'])
 };
}
