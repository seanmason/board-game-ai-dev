/** Small, repeatable Pentago agent tournaments; no human-strength claims.
 * npm run benchmark:pentago -- --games=20 --playouts=24 --opponent=greedy
 */
import {performance} from "node:perf_hooks";
import {
  newGame,uniqueLegalActions,applyAction,outcomes,seededRandom
} from "../pentago/core.js";
import {createSearch,runSearch,bestAction,positionScore} from "../pentago/ai.js";
const setting=(k,def)=>{
 const arg=process.argv.find(x=>x.startsWith("--"+k+"="));
 return arg?arg.slice(k.length+3):def;
};
const number=(k,def,min,max)=>{
 const value=Number(setting(k,def));
 if(!Number.isInteger(value)||value<min||value>max)throw Error("Invalid "+k);
 return value;
};
const games=number("games",12,1,10000);
const playouts=number("playouts",24,1,10000);
const seed=number("seed",913,1,2147483647);
const opponent=setting("opponent","greedy");
if(!["random","greedy","stochastic"].includes(opponent))throw Error("Unknown opponent");
function chooseOpponent(state,rng){
 const choices=uniqueLegalActions(state);
 if(opponent==="random")return choices[Math.floor(rng()*choices.length)];
 const scored=choices.map(a=>{
   const next=applyAction(state,a);
   let quality;
   if(next.phase==="gameover")quality=next.winner===state.currentPlayer?100000:
     next.winner==="draw"?0:-100000;
   else quality=positionScore(next.board)*(state.currentPlayer===0?1:-1);
   return {a,quality};
 });
 if(opponent==="stochastic"){
   const top=Math.max(...scored.map(c=>c.quality));
   const eligible=scored.filter(c=>c.quality>top-45);
   return eligible[Math.floor(rng()*eligible.length)].a;
 }
 scored.sort((a,b)=>b.quality-a.quality);
 return scored[0].a;
}
let won=0,tied=0,scoreShare=0,simulations=0,searchMs=0,totalMoves=0;
const started=performance.now();
for(let g=0;g<games;g++){
 const aiSeat=g%2;
 let state=newGame({starter:Math.floor(g/2)%2,mode:"digital"});
 const random=seededRandom((seed^(g*0x9e3779b1))>>>0);
 let limit=0;
 while(state.phase==="play"){
   if(limit++>36)throw Error("Pentago game exceeded 36 turns");
   let move;
   if(state.currentPlayer===aiSeat){
     const search=createSearch(state,{
       rng:seededRandom((seed^(g*4451+state.ply*431))>>>0),
       maxNodes:Math.max(500,playouts+30),
       rolloutLength:9
     });
     const before=performance.now();
     runSearch(search,playouts);
     searchMs+=performance.now()-before;
     simulations+=search.iterations;
     move=bestAction(search);
   } else move=chooseOpponent(state,random);
   state=applyAction(state,move);
   totalMoves++;
 }
 const share=outcomes(state)[aiSeat];
 scoreShare+=share;
 if(share===1)won++;
 if(share===0.5)tied++;
}
const rate=scoreShare/games;
const z=1.96;
const center=(rate+z*z/(2*games))/(1+z*z/games);
const margin=z/(1+z*z/games)*
  Math.sqrt(rate*(1-rate)/games+z*z/(4*games*games));
console.log(JSON.stringify({
  type:"exploratory Pentago agent tournament",config:{games,playouts,opponent,seed},
  performance:{totalMs:Math.round(performance.now()-started),
    searchMs:Math.round(searchMs),simulations,
    simulationsPerSecond:searchMs?Math.round(simulations/(searchMs/1000)):0,totalMoves},
  results:{wins:won,ties:tied,winShare:Number(rate.toFixed(3)),
    approximate95PercentRange:[Math.max(0,center-margin),Math.min(1,center+margin)]
      .map(x=>Number(x.toFixed(3)))}
},null,2));
