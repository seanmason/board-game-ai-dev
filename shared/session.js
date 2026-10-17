/** Validate the entire snapshot history before callers replace any live state.
 * Legacy v1 exports/storage keys remain supported. No search trees are persisted.
 * This validates snapshots, not whether every historical transition was legal.
 */
export function readSession(data, {format, validateState, playerCount, seatField = 'seats'}) {
  if (!data || data.version !== 1 || (format && data.format !== format) ||
      !Array.isArray(data.history) || !data.history.length) {
    throw Error('Not a supported game session');
  }
  for (const entry of data.history) {
    if (!entry || typeof entry.label !== 'string' || !entry.state) {
      throw Error('Invalid session history entry');
    }
    validateState(entry.state);
  }
  const index = data.index ?? data.history.length - 1;
  if (!Number.isInteger(index) || index < 0 || index >= data.history.length) {
    throw Error('Invalid session history position');
  }
  const game = data.history[index].state;
  const count = playerCount(game);
  if (data.history.some(entry => playerCount(entry.state) !== count || entry.state.mode !== game.mode)) {
    throw Error('A session cannot change player count or game mode');
  }
  const inputSeats = data[seatField];
  const seats = Array.isArray(inputSeats) && inputSeats.length === count
    ? inputSeats.map(seat => seat === 'ai' ? 'ai' : 'human')
    : Array(count).fill('human');
  return {history: data.history, index, game, seats};
}

export function boundedInteger(value, fallback, min, max) {
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
