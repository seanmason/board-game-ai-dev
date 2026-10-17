/**
 * Independent catalog validation against the community Wingsearch game-card
 * dataset, pinned to a specific Git commit. This audit consumes a GPL source
 * only as reference for cross-checking factual numbers; do not redistribute
 * its contents or art in this project.
 *
 * npm run audit:wingspan:independent
 */
import {BIRDS,BONUSES} from "../wingspan/catalog.js";
const SOURCE="https://raw.githubusercontent.com/navarog/wingsearch/43e5036de9e68fa9c4fabaf4c760412a887adf05/src/assets/data/";
const read=async file=>{
 const response=await fetch(SOURCE+file,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error("Independent reference unavailable: "+file+" ("+response.status+")");
 return response.json();
};
const norm=s=>String(s??"").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]/g,"");
const int=v=>v===null||v===undefined||v===""?0:Number(v);
const present=v=>v!==null&&v!==undefined&&v!==false&&v!==""&&v!=="0";
const candidates=await read("master.json");
const bonusCatalog=await read("bonus.json");
const sourceCardsResponse=await fetch(
  "https://raw.githubusercontent.com/Morgan-Griffiths/wingspan/6603a691d9002884798e8fd57341dea869ea9fdc/birds.json",
  {signal:AbortSignal.timeout(60000)}
);
if(!sourceCardsResponse.ok)throw Error("Original structured powers source unavailable");
const sourceCards=await sourceCardsResponse.json();
if(!Array.isArray(candidates)||!Array.isArray(bonusCatalog))
  throw Error("Wingsearch reference format unexpectedly changed");
const base=candidates.filter(c=>c.Set==="core"&&c.CardType==="Bird"&&!present(c["Swift Start"]));
const byName=new Map(base.map(c=>[norm(c["Common name"]),c]));
const errors=[],warnings=[],referenceExceptions=[],powerSimilarity=[];
const sourceByName=new Map(sourceCards.map(b=>[norm(b.name),b]));
const powerTokens=value=>new Set(String(value??"")
  .replace(/<[^>]*>/g," ")
  .toLowerCase().replace(/\[[^\]]+\]/g,t=>t.slice(1,-1))
  .replace(/[^a-z0-9]+/g," ").split(" ")
  .filter(w=>w.length>=3&&
    !["when","activated","played","once","between","turns",
      "bird","this","your","card","cards","power"].includes(w)));
function similarity(a,b){
 if(!a.size&&!b.size)return 1;
 if(!a.size||!b.size)return 0;
 let common=0;
 for(const x of a)if(b.has(x))common++;
 return Number((2*common/(a.size+b.size)).toFixed(3));
}
const compare=(card,prop,ours,theirs)=>{
 if(ours!==theirs)errors.push({bird:card.name,attribute:prop,ours,theirs});
};
for(const card of BIRDS){
 const ref=byName.get(norm(card.name));
 if(!ref){errors.push({bird:card.name,attribute:"identity",ours:"present",theirs:"missing"});continue;}
 compare(card,"points",card.points,int(ref["Victory points"]));
 compare(card,"eggs",card.eggs,int(ref["Egg limit"]));
 compare(card,"nest",card.nest,
   String(ref["Nest type"]??"none").toLowerCase().trim());
 for(const [habitat,field] of [["forest","Forest"],["grassland","Grassland"],["wetland","Wetland"]])
   compare(card,habitat,card.habitats.includes(habitat),present(ref[field]));
 for(const [food,field] of [
   ["invertebrate","Invertebrate"],["seed","Seed"],["fruit","Fruit"],
   ["fish","Fish"],["rodent","Rodent"],["wild","Wild (food)"]
 ])compare(card,"food."+food,card.food[food],int(ref[field]));
 compare(card,"slash_food",card.either,present(ref["/ (food cost)"]));
 const color=String(ref.Color||"none").toLowerCase();
 compare(card,"power_type",card.powerType,color);
 const upstream=sourceByName.get(norm(card.name));
 if(!upstream){
   errors.push({bird:card.name,attribute:"missing upstream power source"});
 }else{
   const score=similarity(
     powerTokens(upstream.action?.power_text),
     powerTokens(ref["Power text"])
   );
   powerSimilarity.push({name:card.name,code:card.powerCode,score});
 }
 // Check card-specific eligibility for every original bonus whose printed
 // criterion is an intrinsic bird trait rather than a mutable player state.
 for(const bonus of BONUSES){
   if(["breeding_manager","ecologist","oologist","visionary_leader"]
     .includes(bonus.key))continue;
   const field=bonus.name==="Omnivore Specialist"?"Omnivore Expert":
     bonus.name;
   if(!(field in ref))continue;
   const ours=card.bonuses.includes(bonus.key),theirs=present(ref[field]);
   if(card.name==="Tufted Titmouse"&&bonus.key==="anatomist"){
     // The base game's printed Anatomist keywords do not include "tuft"
     // or "tit" (which is etymologically "small bird", not a body part).
     // The modern Wingsearch bonus flag is a known reference-data error.
     if(ours!==false||theirs!==true)
       errors.push({bird:card.name,attribute:"anatomist exception",
         ours,theirs,reason:"Known original-rule interpretation changed"});
     else referenceExceptions.push({
       bird:card.name,bonus:bonus.name,rule:"Original Anatomist keyword list excludes tuft/tit"
     });
   }else compare(card,"bonus."+bonus.key,ours,theirs);
 }
 const oursSpan=Number(card.wingspan),otherSpan=Number(ref.Wingspan);
 if(Number.isFinite(oursSpan)&&Number.isFinite(otherSpan))
   compare(card,"wingspan",oursSpan,otherSpan);
 else if(String(card.wingspan)!==String(ref.Wingspan))
   warnings.push({bird:card.name,field:"wingspan",ours:card.wingspan,theirs:ref.Wingspan});
}
const refBonuses=bonusCatalog.filter(x=>x.Set==="core"&&x.CardType==="Bonus");
const byBonus=new Map(refBonuses.map(x=>[norm(x["Bonus card"]),x]));
const extras=refBonuses.filter(x=>!BONUSES.some(b=>norm(b.name)===norm(x["Bonus card"])))
  .map(x=>({name:x["Bonus card"],cardId:x.id,notes:String(x.Note??"").slice(0,100)}));
for(const b of BONUSES){
 const ref=byBonus.get(norm(b.name));
 if(!ref){errors.push({bonus:b.name,attribute:"identity",reason:"not found"});continue;}
 const vp=String(ref.VP??"");
 if(!vp.includes("point"))warnings.push({bonus:b.name,field:"VP_text",source:vp.slice(0,60)});
}
const summary={
  independentReference:"Wingsearch pinned commit 43e5036de9e68fa9c4fabaf4c760412a887adf05",
  referenceCoreBirds:base.length,ourBirds:BIRDS.length,
  referenceCoreBonuses:refBonuses.length,ourBonuses:BONUSES.length,
  extraReferenceBonuses:extras,
  explainedReferenceExceptions:referenceExceptions,
  comparedBirdPowerTexts:powerSimilarity.length,
  lowAgreementPowerTexts:powerSimilarity.filter(x=>x.score<.6),
  differences:errors.length,warnings:warnings.length,
  sampleDifferences:errors.slice(0,100),sampleWarnings:warnings.slice(0,20)
};
console.log(JSON.stringify(summary,null,2));
if(base.length!==170||BONUSES.length!==26||!BONUSES.every(b=>byBonus.has(norm(b.name))))
  throw Error("Unexpected independent base deck counts");
if(errors.length)process.exitCode=1;
