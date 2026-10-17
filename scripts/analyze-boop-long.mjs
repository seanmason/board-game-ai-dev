import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {newGame,applyAction,assertValid} from '../boop/core.js';
import {fresh,play} from '../validation/boop-reference.js';
const directory=process.argv[2]??'benchmarks/boop-long';
const summary=JSON.parse(await readFile(`${directory}/summary.json`,'utf8'));
const old=JSON.parse(await readFile('benchmarks/boop-tactical-heldout.json','utf8'));
const out=['# Boop: longer-budget evaluation','',
'Engine unchanged from implementation commit `d328f4d`. Same paired random eight-ply openings and seat rotation as the earlier 25 ms experiment, seed 1642911. Tactical greedy uses the same evaluator and exact immediate-win/loss screening, but no stochastic tree search. All trees start fresh; subtree reuse is deliberately disabled in this experiment.','',
'| Budget per guided move | Wins / games | Losses | Capped | Mean move time | Median maximum tree depth | Mean root coverage |',
'| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
`| Earlier nominal 25 ms | ${old.wins}/${old.games} | ${old.losses} | ${old.capped} | ${(old.timing.guided.meanMs/1000).toFixed(3)} s | Not recorded | Not recorded |`];
let verifiedTransitions=0;const paired=[];const oldGames=new Map(old.records.map(r=>[r.game,r]));
for(const s of summary.settings){
 const raw=JSON.parse(await readFile(`${directory}/${s.config.simulations===3000?'tactical-3000':s.config.simulations===10000?'tactical-10000':'tactical-5s-min3000'}.json`,'utf8'));
 for(const record of raw.records){let state=newGame({mode:'digital'}),ref=fresh();
  for(const action of [...record.opening,...record.moves.map(m=>m.action)]){
   state=applyAction(state,action);ref=play(ref,action);assertValid(state);
   assert.deepEqual(state.board,ref.grid.flat());assert.deepEqual(state.pools,ref.supplies);assert.equal(state.winner,ref.winner);assert.equal(state.currentPlayer,ref.turn);verifiedTransitions++;
  }
  assert.equal(state.winner,record.winner);assert.equal(state.ply,record.turns);
 }
 const g=s.timing.guided,label=s.config.simulations?`${s.config.simulations.toLocaleString()} simulations`:'5 s target; minimum 3,000 simulations';
 const oldLosses=raw.records.filter(r=>oldGames.get(r.game).winner!==r.seat),converted=oldLosses.filter(r=>r.winner===r.seat).length;
 const regressions=raw.records.filter(r=>oldGames.get(r.game).winner===r.seat&&r.winner!==null&&r.winner!==r.seat).length;
 paired.push(`- **${label}:** converted ${converted}/${oldLosses.length} previously lost cases into wins; ${regressions} previously won cases became losses.`);
 out.push(`| ${label} | ${s.wins}/${s.games} | ${s.losses} | ${s.capped} | ${(g.timingMs.mean/1000).toFixed(2)} s | ${g.maxDepth.median} | ${(g.rootCoverage.mean*100).toFixed(1)}% |`);
}
out.push('','## Same-opening comparison','',...paired,'','## Search accounting','',
'Counts are MCTS iterations, including terminal-node revisits. Rollouts retain the original eight-move horizon; this experiment increases search effort without changing the rollout policy or evaluator. Maximum tree depth is explicit tree depth before a rollout, not the entire simulated continuation.','',
'| Budget | Total iterations | Terminal tree revisits | Rollouts ending in a real win | Heuristic cutoff leaves | Median iterations/move |',
'| --- | ---: | ---: | ---: | ---: | ---: |');
for(const s of summary.settings){const g=s.timing.guided;out.push(`| ${s.config.simulations??'5 s + minimum'} | ${g.totalIterations} | ${g.terminalTreeVisits} | ${g.terminalRollouts} | ${g.heuristicLeaves} | ${g.iterations.median} |`);assert.equal(g.totalIterations,g.terminalTreeVisits+g.terminalRollouts+g.heuristicLeaves);assert.ok(g.iterations.min>=3000);}
out.push('','## Interpretation limits','',
'These are small synthetic-opponent samples, not human ratings. The 24-game settings contain 12 paired opening seeds; the 12-game time-target setting contains six. Wilson intervals in the raw summaries are descriptive binomial reference intervals and do not adjust for dependence within each opening pair. Higher win rates cannot by themselves establish the difference between the two large budgets.','',
'The fixed-count settings use the same full 24-game opening set as the old result. The time-target setting uses games 0–11 only. Actual times are measured while six ordinary benchmark child processes share an eight-CPU container quota. Nominal five-second searches continue until at least 3,000 iterations have run, even when that overruns five seconds. No capped game is silently scored as a real draw.','',
`All new recorded games were replayed through both the production engine and the separately written two-dimensional rules oracle: **${verifiedTransitions} transitions, zero differences**. The production engine itself was not changed.`,
'','## Reproduce','',
'```sh','npm test','BOOP_EVAL_WORKERS=6 node scripts/evaluate-boop-long.mjs','node scripts/analyze-boop-long.mjs','```','',
'The runner checkpoints after each completed game. Its shards/logs are local intermediates; the aggregate JSON files include complete replayable move traces, search metrics and final outcomes. `environment.json` records the engine/rules hashes and runtime details.','');
await writeFile(`${directory}/REPORT.md`,out.join('\n'));
console.log(out.join('\n'));
