// Explicit allowlist: development previews never copy research, tests or source references.
export const sharedAssets = ['shared/session.js', 'shared/search-worker.js'];
export const games = {
  'ticket-to-ride': ['ticket-to-ride/index.html','ticket-to-ride/styles.css',
    ...['catalog','actions','scoring','core','observations','belief','ai','worker','app'].map(n=>`ticket-to-ride/${n}.js`)],
  hive: ['hive/index.html','hive/styles.css',
    ...['catalog','geometry','actions','core','observations','ai','worker','app'].map(n=>`hive/${n}.js`)],
  'lost-cities': ['lost-cities/index.html','lost-cities/styles.css',
    ...['catalog','scoring','actions','core','observations','belief','ai','worker','app'].map(n=>`lost-cities/${n}.js`)],
  jaipur: ['jaipur/index.html','jaipur/styles.css',
    ...['catalog','scoring','actions','core','observations','belief','ai','worker','app'].map(n=>`jaipur/${n}.js`)],
  'sushi-go': ['sushi-go/index.html','sushi-go/styles.css',
    ...['catalog','scoring','actions','core','observations','belief','ai','worker','app'].map(n=>`sushi-go/${n}.js`)],
  'love-letter': ['love-letter/index.html','love-letter/styles.css',
    ...['catalog','core','observations','belief','ai','worker','app'].map(n=>`love-letter/${n}.js`)],
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
      'rollout','leaf-evaluators','development-evaluators','mechanics-evaluators','planning-evaluators','efficiency-evaluators','final-evaluators','opening-strategy','move-editor','worker','app'].map(n => `wingspan/${n}.js`),
    ...['birds','bonuses','goal-tiles','power-index'].map(n => `wingspan/data/${n}.json`)]
};

export const optionalGames = ['ticket-to-ride','hive','lost-cities','jaipur','sushi-go','love-letter','wingspan','splendor','seven-wonders-duel','carcassonne','cascadia','patchwork','kingdomino'];
export const standaloneGames = Object.keys(games).filter(game => game !== 'wingspan');
export const suiteAssets = ['index.html', 'games.html', 'benchmark-dashboard/index.html', 'benchmark-dashboard/styles.css', 'benchmark-dashboard/app.js', 'benchmark-dashboard/snapshot.json', 'benchmark-dashboard/snapshot-followup.json', 'benchmark-dashboard/snapshot-hive-repetition.json'];
