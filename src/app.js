import {
  COLORS, MARKER, FLOOR_COSTS, wallColor, wallColumn, newGame,
  drawFactories, recordFactories, legalActions, applyAction, outcomes,
  actionKey, assertValid, describeAction
} from "./azul.js";

// No build step or runtime packages: the same folder can be served as a static site.
const STORAGE_KEY = "tabletop-observatory-azul-v1";
const MAX_WORKERS = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1));
const root = document.querySelector("#app");
let history = [{state: newGame(), label: "New physical session"}];
let index = 0, game = history[0].state;
let seatTypes = ["human", "human"];
let view = "companion", selectedColor = 0, selection = null, preview = null;
let pendingFactories = makePending(game), notification = "", generation = 0;
let workers = [], partialResults = new Map(), aggregate = null, searchStarted = 0;
let analysisEnabled = true, workerCount = Math.min(2, MAX_WORKERS);
let searchVariant = "guided-informed";
let hoveredCandidateKey = null;

function makePending(s) { return s.factories.map(() => Array(4).fill(null)); }
const fmt = n => new Intl.NumberFormat("en-US").format(Math.round(n));
const esc = value => String(value).replace(/[&<>"']/g, ch =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const button = (action, label, extra = "", attrs = "") =>
  '<button type="button" data-action="' + action + '" class="' + extra + '" ' + attrs + '>' + label + '</button>';
function tile(color, cls = "") {
  if (color === null || color === undefined || color === -1)
    return '<span class="tile empty ' + cls + '" aria-hidden="true"></span>';
  if (color === MARKER)
    return '<span class="tile marker ' + cls + '" aria-label="Starting-player marker">1</span>';
  return '<span class="tile t' + color + " " + cls + '" title="' + COLORS[color] + '" aria-label="' + COLORS[color] + '"></span>';
}
function countTiles(tiles) {
  const counts = Array(5).fill(0);
  for (const t of tiles) if (t >= 0 && t < 5) counts[t]++;
  return counts;
}
function selectedMatches(source, color) {
  const a = preview ?? selection;
  return a && a.source === source && a.color === color;
}
function candidateFor(source, color, row) {
  return legalActions(game).find(a => a.source === source && a.color === color && a.row === row);
}
function tileOffers(tiles, source) {
  const counts = countTiles(tiles);
  if (!tiles.length) return '<span class="meta">No tiles</span>';
  return counts.map((n, c) => n > 0
    ? button("select-source", tile(c) + '<span class="count">×' + n + '</span>',
      "tile-count" + (selectedMatches(source, c) ? " selected" : ""),
      'data-source="' + source + '" data-color="' + c + '" aria-label="Choose ' + COLORS[c] + ' from ' +
      (source < 0 ? 'center' : 'factory ' + (source + 1)) + '"')
    : "").join("");
}
function showSources() {
  const header = '<div class="card-head"><div><h2>Factory offer</h2><p>Select a factory or the center, then a pattern row</p></div>' +
    '<span class="eyebrow">Draft phase</span></div>';
  const center = '<section class="center-supply"><h3>Center ' +
    (game.markerAvailable ? '· starting marker available' : '· marker claimed') +
    '</h3><div class="tile-cluster">' + tileOffers(game.center, -1) + '</div></section>';
  const factories = game.factories.map((f, i) =>
    '<section class="factory' + ((preview ?? selection)?.source === i ? ' selected' : '') + '">' +
    '<h3>Factory ' + (i + 1) + '</h3><div class="tile-cluster">' +
    tileOffers(f, i) + '</div></section>').join("");
  return '<section class="card">' + header + center + '<div class="factories">' + factories + '</div></section>';
}
function showRefill() {
  const expected = Math.min(game.factories.length * 4,
    game.bag.reduce((a,b) => a+b,0) + game.discard.reduce((a,b) => a+b,0));
  const entered = pendingFactories.flat().filter(v => v !== null).length;
  const palette = COLORS.map((name, i) =>
    button("palette", tile(i,"mini") + esc(name), "tiny" + (selectedColor === i ? " chosen" : ""),
      'data-color="' + i + '"')).join("") +
    button("palette", "Erase", "tiny" + (selectedColor === -1 ? " chosen" : ""), 'data-color="-1"');
  const controls = '<div class="palette">' + palette + '</div>' +
    '<p class="factory-counter">' + entered + ' / ' + expected + ' observed tiles entered. ' +
    'Select a color, then tap an empty tile slot; keys 1–5 also select colors.</p>';
  const factoryBoxes = pendingFactories.map((f, i) =>
    '<section class="factory"><h3>Factory ' + (i + 1) + '</h3>' +
    '<div class="tile-cluster">' +
    f.map((color, slot) => button("set-slot", tile(color), "tile-slot",
      'data-factory="' + i + '" data-slot="' + slot +
      '" aria-label="Factory ' + (i + 1) + ' tile slot ' + (slot + 1) + '"')).join("") +
    '</div></section>').join("");
  return '<section class="card">' +
    '<div class="card-head"><div><h2>Observe the physical factories</h2>' +
    '<p>Copy the tiles visible on the real table. The app will not invent physical draws.</p></div>' +
    '<span class="eyebrow">Round ' + game.round + '</span></div>' +
    controls + '<div class="factories">' + factoryBoxes + '</div>' +
    '<div class="toolbar-row">' +
    button("confirm-factories", "Confirm observed factories", "primary") +
    button("clear-factories", "Clear entry", "ghost") +
    '</div></section>';
}
function showPlayer(player, i) {
  const current = game.phase === "draft" && game.currentPlayer === i;
  const activeAction = preview ?? selection;
  const options = '<select data-action="seat-type" data-seat="' + i + '" aria-label="Player ' +
    (i+1) + ' control" ' + (game.mode === "physical" ? "disabled" : "") + '>' +
    '<option value="human"' + (seatTypes[i] === "human" ? " selected" : "") + '>Human</option>' +
    '<option value="ai"' + (seatTypes[i] === "ai" ? " selected" : "") + '>AI</option></select>';
  const title = '<div class="player-title"><div><span class="player-name">Player ' + (i+1) +
    '</span><div class="meta">' + (current ? "To move" : (game.starter === i ? "Round starter" : "Player board")) +
    '</div></div><div class="player-options">' + options +
    '<span class="player-score" title="Current score">' + player.score + '</span></div></div>';
  const patterns = player.lines.map((line, r) => {
    const allowed = !!(current && activeAction && candidateFor(activeAction.source, activeAction.color, r));
    const slots = Array.from({length:r+1}, (_,j) =>
      j < r + 1 - line.count ? tile(null) : tile(line.color)).join("");
    return button("place-row", slots, "pattern" + (allowed ? " legal" : ""),
      'data-row="' + r + '" ' + (allowed ? "" : "disabled") +
      ' aria-label="Place tiles in pattern row ' + (r+1) + '"');
  }).join("");
  const wall = player.wall.map((row,r) => row.map((placed,c) =>
    '<span class="wall-cell" title="Wall row ' + (r+1) + ', column ' + (c+1) + '">' +
    tile(wallColor(r,c),placed ? "" : "ghost") + '</span>').join("")).join("");
  const floor = '<div class="floor"><span class="floor-label">Floor</span>' +
    Array.from({length:7}, (_,j) =>
      tile(player.floor[j] === undefined ? null : player.floor[j])).join("") + '</div>';
  const floorAction = current && activeAction && candidateFor(activeAction.source, activeAction.color, -1);
  return '<section class="player-board ' + (current ? "current" : "") + '">' +
    title + '<div class="player-columns"><div class="patterns">' + patterns +
    '</div><div class="wall">' + wall + '</div></div>' + floor +
    (current ? button("place-floor", "Send selected tiles to floor", "floor-target",
      floorAction ? "" : "disabled") : "") + '</section>';
}
function showBoards() {
  return '<section class="card"><div class="card-head"><div><h2>Player boards</h2>' +
    '<p>Pattern rows are left of the wall. Completed rows score between rounds.</p></div>' +
    '<span class="eyebrow">' + game.players.length + ' players</span></div>' +
    '<div class="board-grid">' + game.players.map(showPlayer).join("") + '</div></section>';
}
function showAnalysisPanel() {
  return '<section class="card"><div class="card-head"><div><h2>Position analysis</h2>' +
    '<p>MCTS · current position</p></div>' +
    '<span class="eyebrow" id="search-state"></span></div>' +
    '<div class="search-tools"><label for="search-variant">Method</label>' +
    '<select id="search-variant" data-action="search-variant" title="Changing the method starts a new search">' +
    '<option value="guided-informed"' + (searchVariant==="guided-informed"?' selected':'') + '>Guided MCTS</option>' +
    '<option value="baseline"' + (searchVariant==="baseline"?' selected':'') + '>UCT baseline</option>' +
    '</select><label for="worker-count">Workers</label>' +
    '<select id="worker-count" data-action="worker-count">' +
    Array.from({length:MAX_WORKERS}, (_,i) =>
      '<option value="' + (i+1) + '"' + (workerCount === i+1 ? " selected" : "") + '>' +
      (i+1) + '</option>').join("") +
    '</select>' +
    button("toggle-search", analysisEnabled ? "Pause analysis" : "Resume analysis", "tiny") +
    (game.mode === "digital" && game.phase === "draft" && seatTypes[game.currentPlayer] === "ai"
      ? button("move-now", "Play Best Move", "tiny primary",
          aggregate?.candidates.length ? "" : 'disabled title="Analyze a position to find the best move"') : "") +
    '</div><div id="analysis-content"></div></section>';
}
function showHistory() {
  const begin = Math.max(0, history.length - 24);
  const entries = history.slice(begin).map((event, n) => {
    const id = begin + n;
    return '<li class="' + (id === index ? "current" : "") + '">' +
      '<span class="idx">' + id + '</span>' +
      button("jump", esc(event.label), "", 'data-index="' + id + '"') + '</li>';
  }).reverse().join("");
  return '<section class="card"><div class="card-head"><h2>Recorded game</h2>' +
    '<span class="meta">' + (index + 1) + ' of ' + history.length + ' states</span></div>' +
    '<div class="toolbar-row">' +
    button("undo", "↶ Undo", "tiny", index ? "" : "disabled") +
    button("redo", "↷ Redo", "tiny", index < history.length - 1 ? "" : "disabled") +
    button("export", "Export game", "tiny") +
    button("import", "Import game", "tiny") +
    '<input id="import-file" class="hidden" type="file" accept="application/json,.json" />' +
    '</div><ol class="timeline">' + entries + '</ol></section>';
}
function showRules() {
  return '<section class="card"><details><summary>How to play · Original Azul</summary>' +
    '<div class="rules-copy">' +
    '<h3>Set up</h3><p>Use five factories with two players, seven with three, or nine with four. ' +
    'Each factory normally receives four tiles; there are twenty tiles of each of five colors.</p>' +
    '<h3>Draft tiles</h3><p>Take every tile of one chosen color from one factory or from the center. ' +
    'A factory’s unchosen tiles move to the center. The first person to take from the center ' +
    'also takes the start-player marker, which occupies a floor space and determines who begins next round.</p>' +
    '<h3>Fill a pattern line</h3><p>Put your chosen tiles on a single pattern row of capacity one through five. ' +
    'You may only add matching tiles to a partly filled line, and cannot place a color already ' +
    'present in that row of your wall. Excess tiles go to the floor. You may choose the floor directly.</p>' +
    '<h3>Score between rounds</h3><p>Each completed pattern line transfers one tile to its fixed matching wall space, ' +
    'working from the top row downward. Connected horizontal and vertical tile chains score; ' +
    'a lone tile is one point. Remaining tiles in completed pattern lines are discarded; ' +
    'incomplete pattern lines stay. The seven floor slots cost 1, 1, 2, 2, 2, 3, 3 points. ' +
    'Scores cannot drop below zero.</p>' +
    '<h3>Finish</h3><p>The game finishes after scoring a round in which anyone completes a horizontal wall row. ' +
    'Add two points per complete horizontal row, seven per vertical column, and ten per complete color set. ' +
    'Highest score wins; ties go to the player with more completed horizontal rows, then are shared.</p>' +
    '<p>Rules summarized in original wording for convenience. ' +
    '<a target="_blank" rel="noopener noreferrer" href="https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf">Official rules reference</a>.</p>' +
    '</div></details></section>';
}
function render() {
  const title = game.phase === "refill" ? "Enter observed factory tiles" :
    game.phase === "gameover" ? "Game complete" :
    "Player " + (game.currentPlayer+1) + " to draft";
  const winnerText = game.phase === "gameover" ? (() => {
    const shares = outcomes(game);
    const winners = shares.map((v,i) => v > 0 ? "Player "+(i+1) : null).filter(Boolean);
    return "Winner" + (winners.length > 1 ? "s" : "") + ": " + winners.join(" and ") +
      ". Final scores: " + game.players.map((p,i) => "P"+(i+1)+" "+p.score).join(" · ");
  })() : "";
  root.innerHTML = '<div class="shell">' +
    '<header class="mast"><div class="brand"><h1>Azul</h1></div>' +
    '<div class="mast-tools">' +
    '<select id="players" aria-label="Player count">' +
    [2,3,4].map(n => '<option value="'+n+'"'+(n===game.players.length?' selected':'')+'>'+n+' players</option>').join("") +
    '</select><select id="mode" aria-label="Session mode">' +
    '<option value="physical"'+(game.mode==='physical'?' selected':'')+'>Physical board</option>' +
    '<option value="digital"'+(game.mode==='digital'?' selected':'')+'>Digital game</option>' +
    '</select><label class="meta" for="starter">First player</label>' +
    '<select id="starter" aria-label="First player for the next new game">' +
    Array.from({length:game.players.length}, (_,i) => '<option value="'+i+'"' +
      (i===game.starter?' selected':'') + '>Player '+(i+1)+'</option>').join("") +
    '</select>' + button("new-game","New session","primary") + '</div></header>' +
    '<nav class="tab-bar">' +
    button("view","Companion","tab"+(view==='companion'?' active':''),'data-view="companion"') +
    button("view","Analysis","tab"+(view==='analyst'?' active':''),'data-view="analyst"') +
    '<span class="meta">Round ' + game.round + ' · ' +
    (game.mode === 'physical' ? "Live board tracking" : "Digital gameplay") + '</span></nav>' +
    (notification ? '<div role="alert" class="banner error">' + esc(notification) + '</div>' : '') +
    '<div class="banner"><strong>' + esc(title) + '</strong>' +
    (game.phase === "refill" ? " · Select a color, then fill the slots to match your real factories. " +
      "Click confirm only when you have recorded every tile." : 
     game.phase === "draft" ? " · Choose a source and color, then click a legal pattern row. " +
       (game.mode === "digital" && seatTypes[game.currentPlayer] === "ai" ?
         "The AI waits for Play Best Move; no autoplay." :
         "AI suggestions never change the real game automatically.") : " · " + esc(winnerText)) +
    '</div>' +
    '<main class="layout"><div>' +
    (game.phase === "refill" ? (game.mode === "physical" ? showRefill() :
      '<section class="card">' + button("digital-refill","Draw next round","primary")+'</section>') :
     game.phase === "draft" ? showSources() : '') +
    showBoards() +
    '</div><aside>' + showAnalysisPanel() + showHistory() + showRules() + '</aside></main>' +
    '</div>';
  renderAnalysis();
}
function mergeWorkerResults() {
  const merged = new Map();
  let iterations = 0, nodes = 0, elapsed = 0, rootPlayer = game.currentPlayer;
  let rootLegalActions = 0;
  for (const data of partialResults.values()) {
    iterations += data.iterations;
    nodes += data.nodeCount;
    elapsed = Math.max(elapsed, data.elapsedMs);
    rootPlayer = data.rootPlayer;
    rootLegalActions = Math.max(rootLegalActions, data.rootLegalActions ?? 0);
    for (const candidate of data.candidates) {
      const entry = merged.get(candidate.key) ?? {
        key:candidate.key, action:candidate.action, label:candidate.label, visits:0,
        winSum:Array(game.players.length).fill(0), scoreSum:Array(game.players.length).fill(0),
        rewardSum:Array(game.players.length).fill(0)
      };
      entry.visits += candidate.visits;
      for (let p=0;p<game.players.length;p++) {
        entry.winSum[p] += candidate.winSum[p];
        entry.scoreSum[p] += candidate.scoreSum[p];
        entry.rewardSum[p] += candidate.rewardSum[p];
      }
      merged.set(candidate.key, entry);
    }
  }
  const candidates = [...merged.values()].sort((a,b) => b.visits-a.visits ||
    b.rewardSum[rootPlayer]/Math.max(1,b.visits)-a.rewardSum[rootPlayer]/Math.max(1,a.visits));
  aggregate = {iterations,nodes,elapsed,candidates,rootPlayer,rootLegalActions};
}
function renderAnalysis() {
  const node = document.querySelector("#analysis-content");
  const status = document.querySelector("#search-state");
  if (!node || !status) return;
  const canAnalyze = game.phase === "draft";
  status.textContent = canAnalyze ? (analysisEnabled ? "Analyzing" : "Paused") : "Waiting";
  if (!canAnalyze) {
    node.innerHTML = '<p class="muted">Analysis starts as soon as a factory offer has been recorded.</p>';
    return;
  }
  const data = aggregate;
  const best = data?.candidates[0];
  const recommended = best ? '<div class="recommendation"><span class="eyebrow">Current leading move</span>' +
    '<div><strong>' + esc(best.label) + '</strong></div>' +
    '<p>Estimated outcome based on simulations, not a calibrated probability.</p>' +
    button("preview-best","Highlight suggestion","tiny") +
    ' ' + button("commit-best",game.mode==="physical"?"Record suggested move":"Play suggested move","tiny primary") +
    '</div>' : '<div class="recommendation">Exploring the available choices…</div>';
  const stats = '<div class="stats-grid">' +
    '<div class="stat"><span class="meta">Simulations</span><span class="value">' + fmt(data?.iterations ?? 0) + '</span></div>' +
    '<div class="stat"><span class="meta">Simulations/s</span><span class="value">' +
    fmt(data?.elapsed > 0 ? data.iterations / (data.elapsed/1000) : 0) + '</span></div>' +
    '<div class="stat"><span class="meta">Tree nodes</span><span class="value">' + fmt(data?.nodes ?? 0) + '</span></div></div>';
  const candidateRows = (data?.candidates ?? []).slice(0, view==="analyst"?40:9).map((c,i) => {
    const win = c.visits ? (100*c.winSum[data.rootPlayer]/c.visits).toFixed(1) : "—";
    const score = c.visits ? (c.scoreSum[data.rootPlayer]/c.visits).toFixed(1) : "—";
    const selected = preview && actionKey(preview) === c.key;
    return '<tr data-candidate-key="' + esc(c.key) + '" class="' + (selected ? "highlight" : "") + '"><td>' +
      button("preview-move", (i+1)+'. '+esc(c.label),"",'data-key="'+esc(c.key)+'"') +
      '</td><td class="right">' + win + (c.visits?"%":"") + '</td>' +
      '<td class="right">' + score + '</td><td class="right">' +
      fmt(c.visits) + '</td></tr>';
  }).join("");
  const table = '<div class="table-scroll"><table class="moves"><thead><tr><th>Candidate move</th>' +
    '<th class="right">Win est.</th><th class="right">Avg score</th><th class="right">Visits</th>' +
    '</tr></thead><tbody>' + (candidateRows ||
      '<tr><td colspan="4">Search will list candidate moves as simulations finish.</td></tr>') +
    '</tbody></table></div>';
  const coverage = data && data.rootLegalActions ?
    '<p class="meta" id="search-coverage">Explored ' + data.candidates.length +
    ' of ' + data.rootLegalActions + ' legal moves</p>' :
    '<p class="meta" id="search-coverage">Starting search</p>';
  node.innerHTML = recommended + stats + coverage + table +
    '<p class="meta">Win estimates come from simulated games and depend on the rollout policy. ' +
    'Opponent strategies are approximated. A higher visit count generally indicates greater search attention.</p>';
  // Progress updates replace the candidate table, but hover state and the
  // button outside this panel must remain synchronized with the new results.
  const moveNow = document.querySelector('button[data-action="move-now"]');
  if (moveNow) moveNow.disabled = !best;
  applyCandidateHover();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version:1, history,index,seatTypes,view,analysisEnabled,workerCount,searchVariant,pendingFactories,selectedColor
  })); } catch (error) { console.warn("Could not autosave:", error); }
}
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.history) || !data.history.length) return;
    data.history.forEach(e => assertValid(e.state));
    history = data.history;
    index = Math.min(history.length-1, Math.max(0, data.index ?? history.length-1));
    game = history[index].state;
    seatTypes = Array.isArray(data.seatTypes) && data.seatTypes.length === game.players.length
      ? data.seatTypes : game.players.map(() => "human");
    view = data.view === "analyst" ? "analyst" : "companion";
    analysisEnabled = data.analysisEnabled !== false;
    workerCount = Math.min(MAX_WORKERS, Math.max(1, data.workerCount || workerCount));
    searchVariant = data.searchVariant === "baseline" ? "baseline" : "guided-informed";
    selectedColor = Number.isInteger(data.selectedColor) ? data.selectedColor : 0;
    pendingFactories = Array.isArray(data.pendingFactories) &&
      data.pendingFactories.length === game.factories.length ? data.pendingFactories : makePending(game);
  } catch (error) { console.warn("Invalid saved game, creating new session:", error); }
}
function applyCandidateHover() {
  for (const el of root.querySelectorAll(
    ".ai-hover-source, .ai-hover-color, .ai-hover-destination, .ai-hover-candidate"
  )) {
    el.classList.remove("ai-hover-source", "ai-hover-color",
      "ai-hover-destination", "ai-hover-candidate");
  }
  if (!hoveredCandidateKey || game.phase !== "draft") return;
  const candidate = aggregate?.candidates.find(c => c.key === hoveredCandidateKey);
  if (!candidate) { hoveredCandidateKey = null; return; }
  const {source, color, row} = candidate.action;
  const hoverRow = [...root.querySelectorAll("tr[data-candidate-key]")]
    .find(el => el.dataset.candidateKey === hoveredCandidateKey);
  hoverRow?.classList.add("ai-hover-candidate");
  const sourceEl = source < 0 ? root.querySelector(".center-supply") :
    root.querySelectorAll(".factories .factory")[source];
  sourceEl?.classList.add("ai-hover-source");
  const chosenTiles = [...root.querySelectorAll(".tile-count")].find(el =>
    Number(el.dataset.source) === source && Number(el.dataset.color) === color);
  chosenTiles?.classList.add("ai-hover-color");
  const board = root.querySelector(".player-board.current");
  const destination = row < 0 ? board?.querySelector(".floor-target") :
    [...(board?.querySelectorAll(".pattern[data-row]") ?? [])].find(
      el => Number(el.dataset.row) === row);
  destination?.classList.add("ai-hover-destination");
}
function stopAnalysis() {
  // Changing the position or worker count invalidates the current tree.
  // PAUSING is deliberately not implemented here.
  generation++;
  workers.forEach(w => w.terminate());
  workers = [];
  partialResults.clear();
  aggregate = null;
  hoveredCandidateKey = null;
}
function startAnalysis() {
  stopAnalysis();
  if (game.phase !== "draft") { renderAnalysis(); return; }
  searchStarted = Date.now();
  if (analysisEnabled && typeof Worker !== "undefined") {
    for (let i=0; i<workerCount; i++) {
      const worker = new Worker(new URL("./ai-worker.js", import.meta.url), {type:"module"});
      worker.onmessage = e => {
        const data=e.data;
        if (data.generation !== generation) return;
        if (data.type === "error") {
          notification = "Search worker error: " + data.message; render(); return;
        }
        if (data.type !== "progress") return;
        partialResults.set(i, data);
        mergeWorkerResults();
        renderAnalysis();
      };
      worker.onerror = e => {
        notification = "The analysis worker could not start. You may still record moves.";
        console.error(e); render();
      };
      workers.push(worker);
      worker.postMessage({
        type:"start",generation,state:game,
        seed:(Math.random()*4294967296)>>>0, maxNodes:18000, batch:8,
        variant:searchVariant
      });
    }
  }
  renderAnalysis();
}
function setAnalysisEnabled(enabled) {
  if (analysisEnabled === enabled) return;
  analysisEnabled = enabled;
  save();
  if (game.phase !== "draft") { render(); return; }
  if (workers.length) {
    // The very same worker and in-memory MCTS tree survives pause/resume.
    const command = enabled ? "resume" : "pause";
    for (const worker of workers) worker.postMessage({type:command,generation});
    render();
  } else if (enabled) {
    // A new position loaded while paused has no search tree to resume yet.
    render();
    startAnalysis();
  } else {
    render();
  }
}
function makeAIMove() {
  // Never fall back to a random/heuristic unexamined move in "Play Best Move".
  const action = aggregate?.candidates[0]?.action;
  if (!action) {
    notification = "No analyzed move yet. Resume analysis and allow at least one simulation.";
    render();
    return;
  }
  commitAction(action);
}
function afterChange() {
  selection = null; preview = null; notification = "";
  if (game.phase === "refill") pendingFactories = makePending(game);
  save(); render(); startAnalysis();
}
function commit(next, label) {
  assertValid(next);
  history = history.slice(0,index+1);
  history.push({state:next, label});
  index = history.length-1; game = next;
  if (game.mode === "digital" && game.phase === "refill") {
    const nextRound = drawFactories(game);
    assertValid(nextRound);
    history.push({state:nextRound, label:"Draw round "+nextRound.round+" factories"});
    index++; game=nextRound;
  }
  afterChange();
}
function commitAction(action) {
  const next = applyAction(game,action);
  const actor = game.currentPlayer;
  commit(next,"Player "+(actor+1)+": "+describeAction(action));
}
function beginNew() {
  const players = Number(document.querySelector("#players").value);
  const mode = document.querySelector("#mode").value;
  const starter = Number(document.querySelector("#starter").value);
  game = newGame({players, mode, starter});
  if (mode === "digital") game = drawFactories(game);
  history = [{state:game, label:"New "+mode+" session"}];
  index=0; seatTypes=Array.from({length:players},()=> "human");
  afterChange();
}
function fillObserved() {
  const arrays = pendingFactories.map(factory => factory.filter(v => v !== null));
  const available = game.bag.reduce((a,b)=>a+b,0) + game.discard.reduce((a,b)=>a+b,0);
  const expected = Math.min(game.factories.length*4,available);
  const actual = arrays.reduce((n,f)=>n+f.length,0);
  if (actual !== expected) throw Error("Enter exactly "+expected+" observed tiles before confirming ("+actual+" entered).");
  for (let i=0;i<arrays.length;i++) {
    const expectedForFactory = Math.min(4,Math.max(0, expected-i*4));
    if (arrays[i].length !== expectedForFactory)
      throw Error("Factory "+(i+1)+" needs "+expectedForFactory+" tiles.");
  }
  commit(recordFactories(game,arrays),"Observed round "+game.round+" factories");
}
function navTo(nextIndex) {
  if (nextIndex < 0 || nextIndex >= history.length) return;
  index=nextIndex; game=history[index].state;
  afterChange();
}
function downloadGame() {
  const content = JSON.stringify({
    format:"tabletop-observatory-game",version:1,history,index,seatTypes
  },null,2);
  const file = new Blob([content],{type:"application/json"});
  const url=URL.createObjectURL(file);
  const link=document.createElement("a");
  link.href=url; link.download="azul-session.json"; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function uploadGame(file) {
  const data=JSON.parse(await file.text());
  if (data.format !== "tabletop-observatory-game" || data.version !== 1 ||
      !Array.isArray(data.history) || !data.history.length) throw Error("Not a supported game export");
  data.history.forEach(entry=>assertValid(entry.state));
  history=data.history; index=Math.min(history.length-1,Math.max(0,data.index ?? history.length-1));
  game=history[index].state;
  seatTypes=Array.isArray(data.seatTypes) && data.seatTypes.length===game.players.length
    ? data.seatTypes : game.players.map(()=>"human");
  afterChange();
}
root.addEventListener("click", event => {
  const target=event.target.closest("button[data-action]");
  if (!target || target.disabled) return;
  const action=target.dataset.action;
  try {
    if (action==="new-game") beginNew();
    else if (action==="view") {view=target.dataset.view;hoveredCandidateKey=null;save();render();}
    else if (action==="palette") {
      selectedColor=Number(target.dataset.color);save();render();
    }
    else if (action==="set-slot") {
      pendingFactories[Number(target.dataset.factory)][Number(target.dataset.slot)] =
        selectedColor<0 ? null : selectedColor;
      save();render();
    }
    else if (action==="clear-factories") {pendingFactories=makePending(game);save();render();}
    else if (action==="confirm-factories") fillObserved();
    else if (action==="digital-refill") commit(drawFactories(game),"Draw round "+game.round+" factories");
    else if (action==="select-source") {
      const source=Number(target.dataset.source),color=Number(target.dataset.color);
      selection = selectedMatches(source,color) && !preview ? null : {source,color};
      preview=null;render();
    }
    else if (action==="place-row" || action==="place-floor") {
      const src = preview ?? selection;
      if (!src) return;
      const row=action==="place-floor"?-1:Number(target.dataset.row);
      const legal=candidateFor(src.source,src.color,row);
      if (legal) commitAction(legal);
    }
    else if (action==="undo") navTo(index-1);
    else if (action==="redo") navTo(index+1);
    else if (action==="jump") navTo(Number(target.dataset.index));
    else if (action==="export") downloadGame();
    else if (action==="import") document.querySelector("#import-file").click();
    else if (action==="toggle-search") setAnalysisEnabled(!analysisEnabled);
    else if (action==="move-now") makeAIMove();
    else if (action==="preview-best" || action==="preview-move") {
      const chosen=action==="preview-best" ? aggregate?.candidates[0] :
        aggregate?.candidates.find(c=>c.key===target.dataset.key);
      if (!chosen) return;
      preview=chosen.action;selection=null;render();
    }
    else if (action==="commit-best") {
      const selected=preview ?? aggregate?.candidates[0]?.action;
      if (selected) commitAction(selected);
    }
  } catch (error) {
    notification=error.message;render();
  }
});
root.addEventListener("change",event=>{
  const node=event.target;
  if (node.id==="import-file" && node.files?.length) {
    uploadGame(node.files[0]).catch(err => {notification=err.message;render();});
  } else if (node.id === "players") {
    // Keep initial-player choices consistent with a pending player-count change.
    const starter = root.querySelector("#starter");
    const before = Number(starter.value);
    const count = Number(node.value);
    starter.innerHTML = Array.from({length:count}, (_,i) =>
      '<option value="'+i+'"' + (i === Math.min(before,count-1)?' selected':'') +
      '>Player '+(i+1)+'</option>').join("");
  } else if (node.dataset.action==="seat-type") {
    seatTypes[Number(node.dataset.seat)]=node.value;save();render();
  } else if (node.dataset.action==="worker-count") {
    workerCount=Math.min(MAX_WORKERS,Math.max(1,Number(node.value)));
    save();render();startAnalysis();
  } else if (node.dataset.action==="search-variant") {
    searchVariant = node.value === "baseline" ? "baseline" : "guided-informed";
    save();render();startAnalysis();
  }
});
// Mouse/pen hover previews never change the game or select a candidate.
// Delegating pointer movement avoids recreating the ever-updating move table.
root.addEventListener("pointermove", event => {
  if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
  const row = event.target.closest("tr[data-candidate-key]");
  const key = row?.dataset.candidateKey ?? null;
  if (key === hoveredCandidateKey) return;
  hoveredCandidateKey = key;
  applyCandidateHover();
});
root.addEventListener("pointerleave", () => {
  if (!hoveredCandidateKey) return;
  hoveredCandidateKey = null;
  applyCandidateHover();
});
document.addEventListener("keydown",event=>{
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase()==="z") {event.preventDefault();navTo(event.shiftKey?index+1:index-1);}
    else if (event.key.toLowerCase()==="y") {event.preventDefault();navTo(index+1);}
    return;
  }
  if (event.target.closest("input,select,textarea")) return;
  if (game.phase==="refill" && /^[1-5]$/.test(event.key)) {
    selectedColor=Number(event.key)-1;save();render();
  } else if (event.key==="Escape") {
    preview=null;selection=null;render();
  }
});
restore();
render();
startAnalysis();
