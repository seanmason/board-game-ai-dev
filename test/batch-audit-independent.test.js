import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

// Set BATCH_AUDIT_WORKTREES=1 before integration to review sibling worktrees.
const moduleUrl = (game, file) => new URL(process.env.BATCH_AUDIT_WORKTREES === '1'
  ? `../../${game}-dev/${game}/${file}` : `../${game}/${file}`, import.meta.url);

// Literal expectations were recorded independently of catalogue/engine helpers.
// Source: firsthand physical inventory at the URL below. Aggregate agreement is
// useful corroboration, not a proof of the complete individual face multiset.
// https://www.reddit.com/r/boardgames/comments/1b8qk3n/some_stats_about_cascadia/
test('independent Cascadia physical component aggregate cross-check', {
  skip: !existsSync(moduleUrl('cascadia', 'catalog.js'))
}, async () => {
  const {TILES} = await import(moduleUrl('cascadia', 'catalog.js'));
  const animals = ['B', 'E', 'S', 'H', 'F'];
  const habitats = ['M', 'F', 'P', 'W', 'R'];
  const animalHabitat = [
    [15, 13, 8, 8, 15], [14, 15, 14, 9, 7], [9, 8, 14, 16, 12],
    [14, 8, 8, 14, 15], [8, 14, 16, 12, 9]
  ];
  const keystones = [
    [1, 2, 0, 0, 2], [2, 1, 2, 0, 0], [0, 0, 2, 2, 1],
    [2, 0, 0, 1, 2], [0, 2, 1, 2, 0]
  ];
  const animalPairs = [
    [32, 7, 11, 8, 11], [7, 32, 9, 10, 9], [11, 9, 32, 8, 8],
    [8, 10, 8, 32, 9], [11, 9, 8, 9, 32]
  ];
  assert.equal(TILES.length, 85);
  const count = pred => TILES.filter(pred).length;
  assert.deepEqual(animals.map(a => habitats.map(h =>
    count(t => t.wildlife.includes(a) && t.sides.includes(h)))), animalHabitat);
  assert.deepEqual(animals.map(a => habitats.map(h =>
    count(t => t.keystone && t.wildlife.includes(a) && t.sides.includes(h)))), keystones);
  assert.deepEqual(animals.map(a => animals.map(b =>
    count(t => t.wildlife.includes(a) && t.wildlife.includes(b)))), animalPairs);
  assert.deepEqual(habitats.map(h => count(t => t.sides.includes(h))), [29, 29, 29, 29, 29]);
  for (let a = 0; a < habitats.length; a++) for (let b = a + 1; b < habitats.length; b++) {
    assert.equal(count(t => t.sides.includes(habitats[a]) && t.sides.includes(habitats[b])), 6);
  }
});

// Independently read from the printed five starter components in this image:
// https://media.cdn.kaufland.de/product-images/1024x1024/13df45d32835e2a127d4777a55b0b19d.jpg
// Each triple is top, lower-right, lower-left; edge order E,SE,SW,W,NW,NE.
test('independent Cascadia printed starter geometry', {
  skip: !existsSync(moduleUrl('cascadia', 'core.js'))
}, async () => {
  const {starterBoard} = await import(moduleUrl('cascadia', 'core.js'));
  const expected = [
    [['MMMMMM', 'B'], ['RPPPRR', 'BS'], ['WWWFFF', 'EFH']],
    [['WWWWWW', 'H'], ['PMMMPP', 'BF'], ['FFFRRR', 'EHS']],
    [['PPPPPP', 'F'], ['FMMMFF', 'BE'], ['RRRWWW', 'FHS']],
    [['RRRRRR', 'S'], ['MWWWMM', 'FH'], ['FFFPPP', 'BES']],
    [['FFFFFF', 'E'], ['WPPPWW', 'FS'], ['RRRMMM', 'BEH']]
  ];
  for (let i = 0; i < 5; i++) {
    const board = starterBoard(i);
    assert.deepEqual(board.map(t => [t.q, t.r]), [[0, 0], [0, 1], [-1, 1]]);
    assert.deepEqual(board.map(t => [t.sides, [...t.wildlife].sort().join('')]), expected[i]);
    assert.deepEqual(board.map(t => t.keystone), [true, false, false]);
  }
});

// Publisher p20 shows bottom pair as the only initially accessible Age III cards.
// A wrong horizontal position of the middle pair previously freed upper index8.
test('independent Duel Age III initial accessible card regression', {
  skip: !existsSync(moduleUrl('seven-wonders-duel', 'core.js'))
}, async () => {
  const {layout, accessible} = await import(moduleUrl('seven-wonders-duel', 'core.js'));
  const s = {board: layout(3).map(x => ({...x, removed: false}))};
  assert.deepEqual(s.board.flatMap((_, i) => accessible(s, i) ? [i] : []), [18, 19]);
  assert.deepEqual(s.board[9].covers, [5, 6]);
  assert.deepEqual(s.board[10].covers, [7, 8]);
});

test('independent Carcassonne import rejects completed occupied features and HTML events', {
  skip: !existsSync(moduleUrl('carcassonne', 'core.js'))
}, async () => {
  const c = await import(moduleUrl('carcassonne', 'core.js'));
  let s = c.drawTile(c.newGame(), 'E');
  s = c.applyAction(s, {type: 'place', x: 0, y: -1, r: 2, feature: null});
  c.assertValid(s);
  const completed = structuredClone(s);
  completed.meeples.push({k: '0,0', feature: 0, player: 0});
  completed.players[0].supply--;
  assert.throws(() => c.assertValid(completed));
  const html = structuredClone(s);
  html.events = [{type: '<img src=x onerror=alert(1)>', points: 1, players: [0], explanation: 'test'}];
  assert.throws(() => c.assertValid(html));
  const htmlPoints = structuredClone(s);
  htmlPoints.events = [{type: 'city', points: '<img src=x onerror=alert(1)>', players: [0], explanation: 'test'}];
  assert.throws(() => c.assertValid(htmlPoints));
});

test('independent Patchwork import rejects future discarded leather and impossible time', {
  skip: !existsSync(moduleUrl('patchwork', 'core.js'))
}, async () => {
  const p = await import(moduleUrl('patchwork', 'core.js'));
  const s = p.newGame({mode: 'digital'});
  p.assertValid(s);
  const discarded = structuredClone(s);
  discarded.discarded = [...discarded.leather];
  discarded.leather = [];
  assert.throws(() => p.assertValid(discarded));
  const time = structuredClone(s);
  time.players[1].placements = [{id: 2, orientation: 0, x: 0, y: 0}];
  for (const i of p.placementCells(2, 0, 0, 0)) time.players[1].board[i] = 2;
  time.ring = time.ring.filter(id => id !== 2);
  assert.throws(() => p.assertValid(time));
});

test('independent Kingdomino import requires matching-terrain route to castle', {
  skip: !existsSync(moduleUrl('kingdomino', 'core.js'))
}, async () => {
  const k = await import(moduleUrl('kingdomino', 'core.js'));
  let s = k.observeRow(k.newGame(), [1, 3, 7, 10]);
  for (const id of [1, 3, 7, 10]) s = k.applyAction(s, {type: 'pick', id});
  s = k.observeRow(s, [2, 4, 8, 11]);
  s = k.applyAction(s, {type: 'place', x: 1, y: 0, rotation: 0});
  s = k.applyAction(s, {type: 'pick', id: 2});
  s = k.applyAction(s, {type: 'place', x: 0, y: -1, rotation: 0});
  k.assertValid(s);
  for (const cell of s.players[0].board) if (cell.id === 3) {
    cell.x = cell.half === 0 ? 3 : 4;
    cell.y = 0;
  }
  assert.throws(() => k.assertValid(s));
});

test('independent Carcassonne joined local cities count one tile and one farm adjacency', {
  skip: !existsSync(moduleUrl('carcassonne', 'core.js'))
}, async () => {
  const {graph, featurePoints} = await import(moduleUrl('carcassonne', 'core.js'));
  // H's initially separate east/west caps join through the five tiles above it.
  // There are seven local city segments, six physical tiles and three shields.
  const board = {
    '0,0': {id: 'H', r: 0}, '1,0': {id: 'N', r: 3}, '-1,0': {id: 'N', r: 0},
    '1,-1': {id: 'M', r: 2}, '-1,-1': {id: 'M', r: 1}, '0,-1': {id: 'F', r: 1}
  };
  const g = graph({board, meeples: []});
  const city = g.byNode['0,0:0'];
  assert.equal(city, g.byNode['0,0:1']);
  assert.equal(city.nodes.length, 7);
  assert.equal(city.tiles.size, 6);
  assert.equal(city.shields, 3);
  assert.equal(city.open, 0);
  assert.equal(featurePoints(city, g), 18);
  const farm = g.byNode['0,0:2'];
  assert.equal(farm.cities.size, 1);
  assert.equal(featurePoints(farm, g, true), 3);
});

test('independent Patchwork top token, new income and multiple crossed income events', {
  skip: !existsSync(moduleUrl('patchwork', 'core.js'))
}, async () => {
  const p = await import(moduleUrl('patchwork', 'core.js'));
  const ring = [6, 2, 8, ...Array.from({length: 33}, (_, i) => i + 1)
    .filter(id => ![1, 2, 6, 8].includes(id)), 1];
  let s = p.observeSetup(p.newGame(), ring, 'corrected');
  s = p.applyAction(s, {type: 'buy', id: 6, orientation: 0, x: 0, y: 0});
  s = p.applyAction(s, {type: 'advance'}); // P1 to3, buttons8.
  s = p.applyAction(s, {type: 'advance'}); // P0 to4, buttons4.
  s = p.applyAction(s, {type: 'buy', id: 2, orientation: 0, x: 0, y: 0});
  assert.equal(s.players[1].time, 4);
  assert.equal(s.currentPlayer, 1); // Newly arriving token is on top.
  s = p.applyAction(s, {type: 'buy', id: 8, orientation: 0, x: 3, y: 0});
  assert.equal(s.players[1].time, 10);
  assert.equal(s.players[1].buttons, 3); // 5−4+2 newly acquired income.
  s = p.applyAction(s, {type: 'advance'});
  assert.equal(s.players[0].time, 11);
  assert.equal(s.players[0].buttons, 13); // 4+7 actual spaces+2 income events.
  p.assertValid(s);
});

test('independent Patchwork physical square and blue H geometry', {
  skip: !existsSync(moduleUrl('patchwork', 'catalog.js'))
}, async () => {
  const {PATCHES} = await import(moduleUrl('patchwork', 'catalog.js'));
  // Visible in https://i.blogs.es/fd8009/patwchork/1366_2000.jpg .
  // The striped6/5/2 patch has four corners, with no missing corner square.
  assert.deepEqual([PATCHES[4].cost, PATCHES[4].time, PATCHES[4].income], [6, 5, 2]);
  assert.equal(PATCHES[4].area, 4);
  assert.equal(PATCHES[4].orientations.length, 1);
  assert.deepEqual(PATCHES[4].cells, [[0, 0], [1, 0], [0, 1], [1, 1]]);
  // Blue H: two cells above the four-cell bar, two below it; not3/5/3.
  assert.equal(PATCHES[28].area, 8);
  assert.deepEqual(PATCHES[28].rows, ['_XX_', 'XXXX', '_XX_']);
  assert.equal(PATCHES.slice(1).reduce((sum, p) => sum + p.area, 0), 166);
});

test('independent Cascadia import preserves rigid starter and digital draw state', {
  skip: !existsSync(moduleUrl('cascadia', 'core.js'))
}, async () => {
  const c = await import(moduleUrl('cascadia', 'core.js'));
  const s = c.createGame({mode: 'digital'});
  c.validateState(s);
  for (const mutate of [
    q => { q.players[0].board[1].rotation = 1; },
    q => { q.players[0].board[0].token = ''; },
    q => { delete q.tileBag; },
    q => { delete q.randomSeed; },
    q => { q.cards.B = ['A']; }
  ]) {
    const invalid = structuredClone(s);
    mutate(invalid);
    assert.throws(() => c.validateState(invalid));
  }
});

test('independent Duel import respects reveal/removal order and own catalogue identities', {
  skip: !existsSync(moduleUrl('seven-wonders-duel', 'core.js'))
}, async () => {
  const d = await import(moduleUrl('seven-wonders-duel', 'core.js'));
  let s = d.createGame({mode: 'digital'});
  for (let i = 0; i < 8; i++) s = d.applyAction(s, d.legalActions(s)[0]);
  d.validateState(s);
  const reveal = structuredClone(s);
  reveal.board[2].up = true;
  assert.throws(() => d.validateState(reveal));
  const removed = structuredClone(s);
  removed.discard.push(removed.board[0].id);
  removed.board[0].id = null;
  removed.board[0].removed = true;
  removed.turn++;
  assert.throws(() => d.validateState(removed));
  const effect = d.createGame();
  effect.phase = 'progress'; effect.progress = ['law']; effect.pending = ['progress'];
  assert.throws(() => d.validateState(effect));
  const identity = d.createGame();
  identity.players[0].wonders = ['constructor'];
  identity.draftUsed = ['constructor']; identity.draftStep = 1;
  assert.throws(() => d.validateState(identity));
});

test('independent hidden-world projections ignore real stacks and unrevealed Duel cards', {
  skip: !existsSync(moduleUrl('seven-wonders-duel', 'core.js')) || !existsSync(moduleUrl('cascadia', 'core.js'))
}, async () => {
  const d = await import(moduleUrl('seven-wonders-duel', 'core.js'));
  let duel = d.createGame({mode: 'digital'});
  for (let i = 0; i < 8; i++) duel = d.applyAction(duel, d.legalActions(duel)[0]);
  const different = structuredClone(duel);
  const hidden = different.board.filter(x => !x.up);
  [hidden[0].id, hidden[1].id] = [hidden[1].id, hidden[0].id];
  different.secret.ages[1][hidden[0].index] = hidden[0].id;
  different.secret.ages[1][hidden[1].index] = hidden[1].id;
  assert.deepEqual(d.observation(duel), d.observation(different));
  assert.deepEqual(d.determinize(d.observation(duel), d.rng(19)), d.determinize(d.observation(different), d.rng(19)));
  const c = await import(moduleUrl('cascadia', 'core.js'));
  const cascade = c.createGame({mode: 'digital'}), alternative = structuredClone(cascade);
  alternative.tileBag.reverse(); alternative.randomSeed = 999;
  assert.deepEqual(c.observation(cascade), c.observation(alternative));
  assert.deepEqual(c.determinize(c.observation(cascade), c.rng(19)), c.determinize(c.observation(alternative), c.rng(19)));
});
