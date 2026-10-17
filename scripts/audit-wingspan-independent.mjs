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
if(!Array.isArray(candidates)||!Array.isArray(bonusCatalog))
  throw Error("Wingsearch reference format unexpectedly changed");
const base=candidates.filter(c=>c.Set==="core"&&c.CardType==="Bird"&&!present(c["Swift Start"]));
const byName=new Map(base.map(c=>[norm(c["Common name"]),c]));
const errors=[],warnings=[];
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
 const oursSpan=Number(card.wingspan),otherSpan=Number(ref.Wingspan);
 if(Number.isFinite(oursSpan)&&Number.isFinite(otherSpan))
   compare(card,"wingspan",oursSpan,otherSpan);
 else if(String(card.wingspan)!==String(ref.Wingspan))
   warnings.push({bird:card.name,field:"wingspan",ours:card.wingspan,theirs:ref.Wingspan});
}
const refBonuses=bonusCatalog.filter(x=>x.Set==="core"&&x.CardType==="Bonus");
const byBonus=new Map(refBonuses.map(x=>[norm(x["Bonus card"]),x]));
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
  differences:errors.length,warnings:warnings.length,
  sampleDifferences:errors.slice(0,100),sampleWarnings:warnings.slice(0,20)
};
console.log(JSON.stringify(summary,null,2));
if(base.length!==170||refBonuses.length!==26)
  throw Error("Unexpected independent base deck counts");
if(errors.length)process.exitCode=1;
