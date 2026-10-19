import {BIRDS,BONUSES,GOAL_TILES} from "./catalog.js";

export const FOOD=["invertebrate","seed","fish","fruit","rodent"];
export const HABITATS=["forest","grassland","wetland"];
export const NESTS=["platform","bowl","cavity","ground"];
const byId=id=>BIRDS[id];
export const allBirds=player=>HABITATS.flatMap(h=>player.habitats[h]);
export const totalEggs=player=>allBirds(player).reduce((n,x)=>n+x.eggs,0);

function bonusCount(card,player){
  const all=allBirds(player),k=card.key;
  if(k==="ecologist")return Math.min(...HABITATS.map(h=>player.habitats[h].length));
  if(k==="visionary_leader")return player.hand.length;
  if(k==="breeding_manager")return all.filter(x=>x.eggs>=4).length;
  if(k==="oologist")return all.filter(x=>x.eggs>0).length;
  return all.filter(x=>byId(x.id).bonuses.includes(k)).length;
}
export function bonusPoints(cardId,player){
  const card=BONUSES[cardId];
  if(!card)throw Error("Unknown bonus card "+cardId);
  const quantity=bonusCount(card,player);
  if(typeof card.per==="number")return quantity*card.per;
  const [small,smallValue,large,largeValue]=card.score;
  return quantity>=large?largeValue:quantity>=small?smallValue:0;
}
export function goalQuantity(player,goal){
  if(!goal)throw Error("Goal face required");
  if(goal.kind==="totalBirds")return allBirds(player).length;
  if(goal.kind==="eggSets")
    return Math.min(...HABITATS.map(h=>
      player.habitats[h].reduce((n,x)=>n+x.eggs,0)));
  if(goal.kind==="birds"){
    const cards=goal.habitat?player.habitats[goal.habitat]:allBirds(player);
    return cards.filter(x=>{
      if(goal.withEgg && x.eggs<1)return false;
      return !goal.nest||[goal.nest,"wild"].includes(byId(x.id).nest);
    }).length;
  }
  if(goal.kind==="eggs"){
    const cards=goal.habitat?player.habitats[goal.habitat]:allBirds(player);
    return cards.reduce((n,x)=>
      n+(!goal.nest||[goal.nest,"wild"].includes(byId(x.id).nest)?x.eggs:0),0);
  }
  throw Error("Unknown round goal kind");
}
const MAJORITY_SCORES=[[4,1,0],[5,2,1],[6,3,2],[7,4,3]];
export function roundGoalScores(players,goal,round,mode="green"){
  if(!Number.isInteger(round)||round<1||round>4)throw Error("Invalid round");
  if(!["green","blue"].includes(mode))throw Error("Goal board side");
  const quantity=players.map(p=>goalQuantity(p,goal));
  if(mode==="blue")return quantity.map(x=>Math.min(5,x));
  const awards=MAJORITY_SCORES[round-1];
  return quantity.map(value=>{
    if(value===0)return 0;
    const ranking=quantity.filter(q=>q>value).length;
    const count=quantity.filter(q=>q===value).length;
    const available=Array.from({length:count},(_,i)=>awards[ranking+i]??0);
    return Math.floor(available.reduce((a,b)=>a+b,0)/count);
  });
}
export function scorePlayer(player){
  const birdEntries=allBirds(player);
  const birds=birdEntries.reduce((n,x)=>n+byId(x.id).points,0);
  const bonuses=player.bonuses.reduce((n,id)=>n+bonusPoints(id,player),0);
  const eggs=totalEggs(player);
  const cached=birdEntries.reduce((n,x)=>n+x.cached.length,0);
  const tucked=birdEntries.reduce((n,x)=>n+x.tucked.length,0);
  const goals=player.goalPoints.reduce((n,x)=>n+x,0);
  const total=birds+bonuses+goals+eggs+cached+tucked;
  return {birds,bonuses,goals,eggs,cached,tucked,total};
}
export function finalOutcome(players){
  const scores=players.map(p=>scorePlayer(p).total);
  const max=Math.max(...scores);
  let eligible=scores.map((n,i)=>n===max?i:-1).filter(i=>i>=0);
  const mostFood=Math.max(...eligible.map(i=>FOOD.reduce((n,k)=>n+players[i].food[k],0)));
  eligible=eligible.filter(i=>FOOD.reduce((n,k)=>n+players[i].food[k],0)===mostFood);
  return players.map((_,i)=>eligible.includes(i)?1/eligible.length:0);
}
export function validateGoalDefinitions(){
  if(GOAL_TILES.length!==8||GOAL_TILES.some(pair=>pair.length!==2))
    throw Error("Original goal tiles must have exactly eight two-sided faces");
  for(const pair of GOAL_TILES){
    for(const face of pair){
      if(!["birds","eggs","eggSets","totalBirds"].includes(face.kind))
        throw Error("Invalid goal face");
    }
  }
  return true;
}
