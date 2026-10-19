/** Browser-safe scalar float32 inference. No filesystem, network or hidden-state access. */
import {FEATURE_VERSION,FEATURE_NAMES,encodeObservation} from './encoder.mjs';
const compiledModels=new WeakSet();
const f=Math.fround;
const check=(ok,message)=>{if(!ok)throw Error('Invalid Wingspan value model: '+message);};
function vector(value,length,label,{positive=false,bound=1e6}={}){
 check(Array.isArray(value)||ArrayBuffer.isView(value),label+' must be numeric array');
 check(value.length===length,label+' length');
 const out=new Float32Array(length);
 for(let i=0;i<length;i++){
  const n=value[i];check(typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=bound&&(!positive||n>=1e-8),label+' nonfinite/out-of-bounds at '+i);
  out[i]=n;check(Number.isFinite(out[i])&&(!positive||out[i]>0),label+' float32 overflow');
 }
 return out;
}
export function isCompiledModel(model){return Boolean(model&&compiledModels.has(model));}
/** Copy/validate once at worker startup; model arrays are never exposed or mutated. */
export function compileModel(json){
 if(isCompiledModel(json))return json;
 check(json&&typeof json==='object','missing model');
 check(json.version===1,'unsupported version');
 check(json.featureVersion===FEATURE_VERSION,'feature version differs');
 check(Array.isArray(json.featureNames)&&json.featureNames.length===FEATURE_NAMES.length&&json.featureNames.every((n,i)=>n===FEATURE_NAMES[i]),'feature names/order differs');
 check(json.valueScale===30,'value scale must be 30 points');
 const inputSize=FEATURE_NAMES.length;
 check(inputSize>0&&inputSize<=4096,'input size exceeds safety bound');
 const mean=vector(json.normalization?.mean,inputSize,'normalization mean');
 const scale=vector(json.normalization?.scale,inputSize,'normalization scale',{positive:true});
 check(Array.isArray(json.layers)&&json.layers.length>0&&json.layers.length<=4,'layer count');
 let previous=inputSize,parameters=0;
 const layers=json.layers.map((l,index)=>{
  check(l&&Number.isInteger(l.in)&&Number.isInteger(l.out)&&l.in===previous&&l.out>=1&&l.out<=4096,'layer dimensions '+index);
  check(['linear','relu'].includes(l.activation),'layer activation '+index);
  check(index!==json.layers.length-1||(l.out===1&&l.activation==='linear'),'final layer must be one linear margin');
  parameters+=l.in*l.out+l.out;check(parameters<=2000000,'parameter bound exceeded');
  previous=l.out;
  return {in:l.in,out:l.out,activation:l.activation,weights:vector(l.weights,l.in*l.out,'weights '+index),bias:vector(l.bias,l.out,'bias '+index),scratch:new Float32Array(l.out)};
 });
 const normalized=new Float32Array(inputSize);
 const predict=features=>{
  check((Array.isArray(features)||ArrayBuffer.isView(features))&&features.length===inputSize,'input feature dimensions');
  for(let i=0;i<inputSize;i++){
   const n=features[i];check(typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e8,'input feature nonfinite/out-of-bounds');
   normalized[i]=f(f(f(n)-mean[i])/scale[i]);
  }
  let input=normalized;
  for(const layer of layers){
   for(let o=0;o<layer.out;o++){
    let value=layer.bias[o],offset=o*layer.in;
    for(let j=0;j<layer.in;j++)value=f(value+f(input[j]*layer.weights[offset+j]));
    check(Number.isFinite(value),'nonfinite inference output');
    layer.scratch[o]=layer.activation==='relu'?Math.max(0,value):value;
   }
   input=layer.scratch;
  }
  const margin=f(input[0]*30);check(Number.isFinite(margin),'nonfinite margin points');return margin;
 };
 const model=Object.freeze({version:1,featureVersion:FEATURE_VERSION,inputSize,parameterCount:parameters,valueScale:30,
  id:typeof json.id==='string'?json.id:null,arithmetic:'scalar-float32-multiply-and-add',predict});
 compiledModels.add(model);return model;
}
/** Returns unscaled score-margin POINTS, never a probability or normalized target. */
export function predictFeatures(model,features){check(isCompiledModel(model),'compile model before inference');return model.predict(features);}
export function predictObservation(model,observation,viewer){return predictFeatures(model,encodeObservation(observation,viewer));}
