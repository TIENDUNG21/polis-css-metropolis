# 0004 Screenshot properties instead of pixel baselines

Status: accepted, 2026-11-17

## Context

The scene is visual, so the tests should look at it. Locally the tests drive Microsoft Edge on Windows (no browser download); CI uses Playwright's Chromium on Linux. Font rendering, GPU paths and anti-aliasing differ between them, so pixel-exact baselines from one would fail on the other, and keeping two sets of baselines would make every visual change a chore.

## Decision

Screenshot tests capture every time, weather and camera preset with motion paused and transitions settled, save the images as CI artifacts, and assert properties that hold for any correct render: mean luminance is ordered night < dusk and dawn < midday; snow cover raises the city's luminance (measured with the sky hidden, since snow clouds darken the sky); rain and fog change more than 20% of pixels; each camera preset changes more than 5% of pixels against the isometric view; the city covers more than a quarter of the frame. Images are decoded in a blank page's canvas, so no image library is needed.

## Consequences

- The tests run unchanged on both platforms and catch blank renders, broken presets and missing layers.
- They do not catch small visual regressions such as a misplaced window pattern. Those are reviewed by eye in the saved images.
