/** Frozen task construction, separate from execution so study plans can be validated cheaply. */
export function buildTasks(metadata,{pairs=40,seedBase=5182600,policy='production-default',opponent='simple-v1',players=null,budget={}}={}){
 if(!Number.isInteger(pairs)||pairs<1||!Number.isInteger(seedBase)||seedBase<0||seedBase+997*(pairs-1)>0xffffffff)throw Error('Invalid setup count or seed range');
 if(!/^[a-z0-9-]+$/.test(policy)||!/^[a-z0-9-]+$/.test(opponent))throw Error('Invalid policy identifier');
 if(players&&(!Array.isArray(players)||!players.length||new Set(players).size!==players.length||players.some(p=>!Number.isInteger(p)||p<2||p>5)))throw Error('Invalid player-count selection');
 if(!budget||typeof budget!=='object'||Array.isArray(budget))throw Error('Budget must be an object');
 const tasks=[];
 for(const [game,m]of Object.entries(metadata)){
  const counts=players??m.supportedPlayers;if(counts.some(p=>!m.supportedPlayers.includes(p)))throw Error(`Unsupported player count for ${game}`);
  for(const count of counts)for(let i=0;i<pairs;i++)for(let seat=0;seat<count;seat++){
   const seed=seedBase+i*997,matchup=`${game}-${count}p-${policy}${opponent==='simple-v1'?'':`-vs-${opponent}`}`;
   tasks.push({id:`${matchup}-${seed}-${seat}`,matchup,game,players:count,seed,seat,policy,opponent,budget:{...m.defaultBudget,...budget},scope:m.scope});
  }
 }
 return tasks;
}
