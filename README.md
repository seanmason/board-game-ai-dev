# Tabletop Observatory — Board Game AI

Browser-native board-game companions for recording physical games and exploring
candidate moves. Full digital play is secondary. The project prioritizes faithful
rules, usable interfaces and competent practical AI across a broad collection.

**Development software:** implementation, verification and AI evidence vary by game.
The development repository/preview have been public; finished reviewed games are
released separately through [board-game-ai](https://github.com/seanmason/board-game-ai).

## Start locally

No runtime dependencies or build step. Serve native modules and Web Workers over HTTP:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/` for the game directory. Azul is at `azul.html`. Do not open HTML files
directly with `file://`.

## Games and documentation

[Current game overviews](docs/games/INDEX.md) cover Azul, Pentago, Splendor, Boop,
7 Wonders Duel, Carcassonne, Cascadia, Patchwork and Kingdomino. Each links its
edition scope, implementation, verification evidence, AI limits and next priorities.
[Wingspan](docs/games/wingspan/README.md) is also available; its overview records supported play and remaining verification.

Physical companions require explicit recording of moves and observed setup/refills.
Analysis previews do not commit moves. Use undo/redo and session export/import to
correct and preserve play. Search values are game-specific estimates; they are not
automatically calibrated win probabilities. See each game's overview for supported
controls, action coverage and recovery limitations.

## Development

Agents start at [AGENTS.md](AGENTS.md), then [documentation routing](docs/INDEX.md).
Shared behavior is mapped in [platform contracts](docs/platform/README.md).

```sh
npm test
npm run check
npm run check:docs
npm run stage:preview
npm run package:game -- boop /tmp/boop-site
```

The package destination must be new. See [release procedure](docs/platform/release.md)
for verification and publication boundaries. Game-specific verifiers, source audits,
benchmarks and browser checks are linked from the overviews. Historical results
remain evidence for their tested configurations, not fresh checks of this checkout.
