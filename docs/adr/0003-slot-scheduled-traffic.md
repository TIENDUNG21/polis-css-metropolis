# 0003 Slot-scheduled traffic

Status: accepted, 2026-11-17

## Context

Cars on two crossing avenues follow fixed `offset-path` routes. CSS animations cannot observe each other, so cars cannot brake for one another, and two cars meeting in the junction would visibly pass through each other.

## Decision

Every route has the same 24 s period. Avenue A owns the junction during the first 12 s of each cycle and avenue B during the second. Each car's phase (its negative `animation-delay`) is chosen so that its pass through the junction falls inside its avenue's half, with about 3 s of clearance at each changeover. Cars on the same lane share a speed, so their spacing never changes. The phases were computed with a short script and are verified by a browser test that pauses all car animations, steps them through a full cycle in 0.2 s increments with the Web Animations API, and checks for touching cars, cars leaving their road, and both avenues in the junction at once.

## Consequences

- No collision logic is needed, and the test checks the property across the whole cycle at 0.2 s resolution.
- Traffic moves in platoons, as it would behind traffic lights.
- Adding a car or changing a route length means re-checking the phases. The test fails if they conflict; this was confirmed by moving one car into the wrong half.
- Cars do not turn. Turning routes would cross both halves of the cycle and need a finer schedule.
