---
name: design-system
description: Airspace's shared visual design in ui/ — the monotone palette (ink, paper, muted, line), Inter only, pill buttons, glass panels, quiet cards, quint-ease motion, reduced motion, and real-data-only empty states. Use for any UI, styling, layout, copy on screen or component work on the website or desktop app.
---

# Design system

Shared through `ui/` (`@fs-career/ui/theme.css`, components in `ui/src/`) so the website and the desktop app
look the same. `ui` is used as source, so its changes show up live.

- Monotone: ink `#0b0d10`, paper `#f6f7f9`, muted `#8a8f98`, line `#22262c`. Emphasis is weight, size or
  inversion, never a second colour; errors get weight, not red.
- Inter is the only typeface (`ui/fonts`). Headings use the `display` utility (semibold, tight tracking).
- Pill buttons (`ActionButton`, `buttonClass`), dark glass panels (`Panel`), quiet cards (`border-paper/10
bg-paper/[0.03]`), rises with the quint ease (`[0.22, 1, 0.36, 1]`), and `MotionConfig reducedMotion="user"`.
- Pages show only real data. Empty states say what will appear ("Nothing yet"), never placeholder numbers.
