# 0002 World state as registered custom properties

Status: accepted, 2026-11-17

## Context

Time of day, weather and the camera affect almost every element: wall shading, window lights, the sky, shadows, snow on roofs and trees, water colour, headlights, street lamps. Without JavaScript there is no event handler to update them. The inputs are radio buttons, and the automatic cycle has to be a CSS animation.

## Decision

All shared state is a small set of custom properties on the `.polis` root, registered with `@property` so each has a type (`<number>`, `<angle>`, `<integer>`). Radio inputs write them through `.polis:has(input[name][value]:checked)` rules; in Auto mode, keyframe animations on the same element write them; components only read them. Colours are derived from base colours and the state with `color-mix()`.

## Consequences

- One mechanism serves both the controls and the automatic cycle, and preset changes interpolate because typed properties can transition.
- Systems are decoupled: adding weather meant adding properties and readers, without touching buildings.
- Integers allow a clock without script: `steps()` animations of `--hour` and `--minute`, printed with CSS counters.
- Cost: a changing inherited property invalidates style for the whole subtree, and colour changes repaint the faces that read them. The sun moved to a stepped animation after a continuous version measured about 39 fps in Auto mode, against about 50 fps stepped on the same machine.
- Browser floor: `@property` and `:has()` are required, with no fallback.
