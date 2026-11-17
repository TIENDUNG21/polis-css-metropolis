# 0001 Build-time components

Status: accepted, 2026-11-17

## Context

A building is four or more elements (three walls, a roof, optional roof parts) plus a shadow on its block's shade layer. The city has 63 buildings, 38 trees, 24 lamps and 14 cars. Written by hand, the markup would be thousands of repetitive lines in which a typo in a class name or a coordinate silently produces a broken or overlapping building.

## Decision

The HTML source describes the city with five custom tags (`polis-block`, `polis-building`, `polis-tree`, `polis-lamp`, `polis-car`). A small expander in `tools/lib/components.js` validates each tag and replaces it with plain elements whose geometry is in inline custom properties. Attribute values are typed (integers in range, a fixed list of kinds, hex colours only), and placement rules are checked across tags: a block must lie inside the world, a building inside its block, and buildings in a block must not overlap. Errors carry the partial's file, line and column.

## Consequences

- The source reads as a city plan and the shipped HTML stays plain.
- Inline styles can only contain the custom properties the expander writes; html-validate enforces that list.
- Values that reach a `style` attribute are validated, so a source typo cannot inject arbitrary CSS.
- The expander is not a general HTML parser. It recognises only `polis-*` tags and does not look inside raw-text elements, which the source never needs.
- Global layout (blocks against roads and the river) is checked by a browser test instead, because the roads are defined in SCSS tokens.
