import {assertValid} from './core.js';
export function publicObservation(s,viewer=s.currentPlayer){if(viewer!==0&&viewer!==1)throw Error('Invalid viewer');assertValid(s);return structuredClone(s);}
export function analysisBlocker(s){if(s.phase==='stalemate-review')return 'Two forced passes: review the position and agree a draw or continue.';if(s.phase!=='play')return 'The recorded game has ended.';return null;}
