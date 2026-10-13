# 18. Hand-built UI components on Tailwind

- **Date:** 2026-10-12
- **Status:** Accepted

## Context

The redesign needs buttons, cards, form fields, a tab bar, a shell for pushed screens,
category chips and a donut chart, in a light and a dark theme, on a phone and a laptop. The
app already uses Tailwind and has no component library. It is a learning project whose code
should be explainable line by line.

## Decision

- A small component set in `frontend/src/components/`, built with Tailwind classes, no new
  runtime dependencies.
- Colors are CSS variables in `index.css`, redefined under `[data-theme="dark"]` and exposed to
  Tailwind with `@theme`. Components use `bg-surface`, `text-muted` and so on, never a
  light/dark pair.
- The donut is about 40 lines of hand-written SVG. It is decorative; the legend and lists show
  the same numbers as text.
- Category colors are ten named palette entries (`amber` … `slate`), validated by the API as a
  `Literal`. Each name has a light and a dark shade. The frontend's palette is a `Record` keyed
  by the generated API type, so the two lists can't drift without a type error.

## Alternatives considered

- **shadcn/ui.** Polished, accessible dialogs and menus built on Radix, copied into the repo.
  The design avoids dialogs and menus (adding and details are full screens), so it would add
  several dependencies for components we don't use.
- **A full UI library (Mantine, Chakra).** Fastest route to widgets, but brings its own styling
  system that competes with Tailwind, and the gradient look would mean overriding its theme
  everywhere.
- **A chart library (Recharts, Chart.js).** Tens of kilobytes for one donut.
- **Any hex color per category.** More freedom, but a color can be unreadable in one of the
  themes and has nothing to map to a dark shade.

## Consequences

- Every component is small and ours to explain; the bundle stays lean.
- Anything advanced (a modal, a date picker) would have to be built or a library adopted later.
- Adding a palette color is a code change in two places (API `Literal`, `index.css`), caught
  by tsc and a test if one side is missed.
