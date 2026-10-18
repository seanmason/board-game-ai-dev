// Explicit allowlist: development previews never copy research, tests or source references.
export const sharedAssets = ['shared/session.js', 'shared/search-worker.js'];
export const games = {
  azul: ['azul.html', 'styles.css', ...['azul','mcts','ai-worker','app'].map(n => `src/${n}.js`)],
  pentago: ['pentago/index.html', 'pentago/styles.css', ...['core','ai','worker','app'].map(n => `pentago/${n}.js`)],
  boop: ['boop/index.html','boop/styles.css',...['core','ai','worker','app'].map(n=>`boop/${n}.js`)],

  splendor: ['splendor/index.html','splendor/styles.css',...['catalog','core','ai','worker','app'].map(n=>`splendor/${n}.js`)],
  ...Object.fromEntries(['seven-wonders-duel','patchwork','kingdomino'].map(game => [game,
    [`${game}/index.html`, `${game}/styles.css`,
      ...['catalog','core','ai','worker','app'].map(name => `${game}/${name}.js`)]])),
  carcassonne: ['carcassonne/index.html','carcassonne/styles.css',
    ...['catalog','core','ai','art','worker','app'].map(name => `carcassonne/${name}.js`)],
  cascadia: ['cascadia/index.html','cascadia/styles.css',
    ...['catalog','scoring','core','ai','worker','app'].map(name => `cascadia/${name}.js`)],
  // Optional draft game: only packaged in a checkout that actually contains it.
  wingspan: ['wingspan/index.html', 'wingspan/styles.css',
    ...['catalog','scoring','powers','core','actions','observation-io','physical-ui','observations','analysis','belief',
      'rollout','leaf-evaluators','development-evaluators','mechanics-evaluators','planning-evaluators','efficiency-evaluators','final-evaluators','move-editor','worker','app'].map(n => `wingspan/${n}.js`),
    ...['birds','bonuses','goal-tiles','power-index'].map(n => `wingspan/data/${n}.json`)]
};

export const optionalGames = ['wingspan','splendor','seven-wonders-duel','carcassonne','cascadia','patchwork','kingdomino'];
export const standaloneGames = Object.keys(games).filter(game => game !== 'wingspan');
export const suiteAssets = ['index.html', 'games.html'];
