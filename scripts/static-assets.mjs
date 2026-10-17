// Explicit allowlist: development previews never copy research, tests or source references.
export const sharedAssets = ['shared/session.js', 'shared/search-worker.js'];
export const games = {
  azul: ['index.html', 'styles.css', ...['azul','mcts','ai-worker','app'].map(n => `src/${n}.js`)],
  pentago: ['pentago/index.html', 'pentago/styles.css', ...['core','ai','worker','app'].map(n => `pentago/${n}.js`)],
  boop: ['boop/index.html','boop/styles.css',...['core','ai','worker','app'].map(n=>`boop/${n}.js`)],
  // Optional draft game: only packaged in a checkout that actually contains it.
  wingspan: ['wingspan/index.html', 'wingspan/styles.css',
    ...['catalog','scoring','powers','core','actions','observations','analysis','belief',
      'rollout','move-editor','worker','app'].map(n => `wingspan/${n}.js`),
    ...['birds','bonuses','goal-tiles','power-index'].map(n => `wingspan/data/${n}.json`)]
};
