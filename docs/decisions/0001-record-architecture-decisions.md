# 1. Record architecture decisions

- **Date:** 2026-10-11
- **Status:** Accepted

## Context

This is a learning project built to practice the whole software lifecycle. Many choices were
made deliberately, with alternatives weighed, but the reasoning lived only in chat history,
pull request descriptions and a local notes file. Anyone reading the repository, including
future me, could see *what* was built but not *why*.

## Decision

Keep one short Markdown file per significant decision in `docs/decisions/`, numbered in order.
Each record states the context, the decision, the alternatives considered, and the
consequences, good and bad. Records are not edited after the fact except to change their
status; a changed decision gets a new record that supersedes the old one.

Bugs, surprises and things learned the hard way go in `docs/lessons-learned.md` instead.

## Consequences

- The reasoning behind the design is reviewable alongside the code.
- Records 2 to 12 were written retroactively on 2026-10-11, with each decision's original date.
