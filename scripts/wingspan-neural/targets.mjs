const COMPONENTS=Object.freeze(['birds','bonuses','goals','eggs','cached','tucked']);
export const AUX_NAMES=Object.freeze(['own','other'].flatMap(side=>COMPONENTS.map(c=>side+'.'+c)));
/** Labels only: never feed terminal true scores into observation encoding. */
export function buildAuxTargets(scoreComponents,viewer){
 if(![0,1].includes(viewer)||scoreComponents?.length!==2)throw Error('Two-player auxiliary score targets required');
 return [viewer,1-viewer].flatMap(i=>COMPONENTS.map(c=>{const n=scoreComponents[i][c];if(!Number.isFinite(n))throw Error('Invalid auxiliary '+c);return n;}));
}
