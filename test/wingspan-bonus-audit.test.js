import test from "node:test";
import assert from "node:assert/strict";
import {BIRDS,BONUSES} from "../wingspan/catalog.js";
import {FOOD,HABITATS,bonusPoints,scorePlayer} from "../wingspan/scoring.js";

const fixture=()=>({
  food:Object.fromEntries(FOOD.map(f=>[f,0])),
  hand:[],bonusOffer:[],bonuses:[],goalPoints:[],
  habitats:Object.fromEntries(HABITATS.map(h=>[h,[]]))
});
const played=(id,eggs=0)=>({id,eggs,cached:[],tucked:[]});
const countTagged=bonus=>BIRDS.filter(b=>b.bonuses.includes(bonus.key));
test("the original set has 26 distinct bonus identities and an evaluator for each",()=>{
  assert.equal(BONUSES.length,26);
  assert.equal(new Set(BONUSES.map(x=>x.name)).size,26);
  assert.ok(BONUSES.every(x=>
    Number.isInteger(x.id)&&(typeof x.per==="number"||
    (Array.isArray(x.score)&&x.score.length===4))));
});
for(const card of BONUSES){
  test("Bonus "+String(card.id).padStart(2,"0")+" · "+card.name,()=>{
    const player=fixture();
    assert.equal(bonusPoints(card.id,player),0,"Empty game earns zero bonus");
    let candidates=countTagged(card);
    const special=new Set(["ecologist","visionary_leader","breeding_manager","oologist"]);
    if(special.has(card.key)){
      if(card.key==="visionary_leader"){
        player.hand=Array.from({length:9},(_,i)=>i);
        const [sm,sv,lg,lv]=card.score;
        assert.equal(bonusPoints(card.id,player),lv);
        player.hand=Array.from({length:sm},(_,i)=>i);
        assert.equal(bonusPoints(card.id,player),sv);
      }else if(card.key==="ecologist"){
        for(const habitat of HABITATS)
          for(let k=0;k<3;k++)player.habitats[habitat].push(played(k));
        assert.equal(bonusPoints(card.id,player),6,"Smallest habitat has 3 birds");
        player.habitats.forest.pop();
        assert.equal(bonusPoints(card.id,player),4);
      }else{
        const need=card.key==="breeding_manager"?4:1;
        for(let k=0;k<10;k++)
          player.habitats.forest.push(played(k,need));
        if(card.per)assert.equal(bonusPoints(card.id,player),10*card.per);
        else assert.equal(bonusPoints(card.id,player),card.score[3]);
      }
    }else{
      assert.ok(candidates.length>0,
        "Every base-game bonus should have at least one qualifying base bird");
      if(typeof card.per==="number"){
        const n=Math.min(3,candidates.length);
        player.habitats.forest=candidates.slice(0,n).map(x=>played(x.id));
        assert.equal(bonusPoints(card.id,player),n*card.per);
      }else{
        const [small,smallVP,large,largeVP]=card.score;
        assert.ok(candidates.length>=large,
          "Bonus must have sufficient base birds to reach second threshold");
        player.habitats.forest=candidates.slice(0,small-1).map(x=>played(x.id));
        assert.equal(bonusPoints(card.id,player),0);
        player.habitats.forest=candidates.slice(0,small).map(x=>played(x.id));
        assert.equal(bonusPoints(card.id,player),smallVP);
        player.habitats.forest=candidates.slice(0,large).map(x=>played(x.id));
        assert.equal(bonusPoints(card.id,player),largeVP);
      }
    }
    // Independently check that bonus points flow into final scoring.
    player.bonuses=[card.id];
    assert.equal(scorePlayer(player).bonuses,bonusPoints(card.id,player));
  });
}


test("Tufted Titmouse is not an Anatomist bird under original printed keywords",()=>{
  const bird=BIRDS.find(b=>b.name==="Tufted Titmouse");
  assert.ok(bird);
  assert.ok(!bird.bonuses.includes("anatomist"));
  const anatomist=BONUSES.find(b=>b.name==="Anatomist");
  const player=fixture();
  player.habitats.forest=[played(bird.id)];
  assert.equal(bonusPoints(anatomist.id,player),0);
});
