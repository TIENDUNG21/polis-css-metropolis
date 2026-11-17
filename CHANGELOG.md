# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-17

First release.

### Added

- City diorama in HTML and CSS: two land slabs, a sunken river with quays, a bridge, and six districts (downtown, civic plaza, old town, park, harbour, riverside) with 63 buildings, 38 trees, 24 street lamps and road markings.
- Buildings with gradient window facades, gable roofs, spires, antennas, roof gardens and a helipad.
- Day and night: a 96 s automatic cycle and Dawn, Day, Dusk and Night presets, with sky layers, sun and moon, stars, staggered window lights, street lamps, headlights, and sun-driven shadows clipped to each block.
- Weather presets: rain, snow that settles and melts, fog planes inside the 3D scene, overcast sky and wet streets.
- Five camera presets with animated moves: Isometric, Aerial, Street, Riverside, Plan.
- Fourteen cars on `offset-path` routes with a slot-scheduled junction, and a barge on the river.
- HUD clock printed with CSS counters.
- Motion control, `prefers-reduced-motion` support, keyboard operation with a visible focus ring, and a phone layout.
- Build with HTML components and layout validation, includes, Dart Sass with warnings as errors, and a dist check that rejects script, event handlers, `javascript:` URLs, `.js` files and root-relative URLs.
- 85 unit tests and 33 Playwright browser tests, a keyframe audit with size budgets, and metrics and screenshot scripts.
- CI on Ubuntu and deployment to GitHub Pages.

[1.0.0]: https://github.com/TIENDUNG21/polis-css-metropolis/releases/tag/v1.0.0
