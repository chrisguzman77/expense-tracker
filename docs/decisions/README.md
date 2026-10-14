# Decision records

Why the system is built the way it is. One file per decision, in the order they were made.
Each states the context, the decision, the alternatives considered, and the consequences.
See [record 1](0001-record-architecture-decisions.md) for the format.

| # | Decision | Date |
|---|---|---|
| 1 | [Record architecture decisions](0001-record-architecture-decisions.md) | 2026-10-11 |
| 2 | [Authentication: JWT in an httpOnly cookie, same origin](0002-jwt-in-httponly-cookie.md) | 2026-09-03 |
| 3 | [Hash passwords with bcrypt directly, not passlib](0003-bcrypt-without-passlib.md) | 2026-09-03 |
| 4 | [Money is a decimal string end to end](0004-money-as-decimal-strings.md) | 2026-09-10 |
| 5 | [Generated API types and openapi-fetch](0005-generated-api-types-and-openapi-fetch.md) | 2026-10-01 |
| 6 | [Branching, merging and branch protection](0006-branching-and-merging.md) | 2026-10-01 |
| 7 | [CI quality gates](0007-ci-quality-gates.md) | 2026-10-07 |
| 8 | [Private access over Tailscale, TLS via `tailscale serve`](0008-private-access-with-tailscale-serve.md) | 2026-10-08 |
| 9 | [Container images on GHCR, public, tagged by commit](0009-container-images-on-ghcr.md) | 2026-10-08 |
| 10 | [Database migrations run as a one-shot compose service](0010-one-shot-migration-service.md) | 2026-10-08 |
| 11 | [The production database lives in an external volume](0011-protected-database-volume.md) | 2026-10-11 |
| 12 | [Encrypted offsite backups with restic, verified by restore drills](0012-encrypted-offsite-backups.md) | 2026-10-11 |
| 13 | [Grow into a personal finance app, data safety first](0013-personal-finance-roadmap.md) | 2026-10-11 |
| 14 | [Host the app on its own VM on the home Proxmox server](0014-dedicated-vm-on-proxmox.md) | 2026-10-12 |
| 15 | [Mobile access through a home-screen web app](0015-mobile-access-as-home-screen-web-app.md) | 2026-10-12 |
| 16 | [Monitor backups with healthchecks.io](0016-backup-monitoring-with-healthchecks.md) | 2026-10-12 |
| 17 | [Registration is closed by default](0017-registration-closed-by-default.md) | 2026-10-12 |
| 18 | [Hand-built UI components on Tailwind](0018-hand-built-ui-components.md) | 2026-10-12 |
| 19 | [Subscriptions before budgets; Plaid's free plan as the planned aggregator](0019-subscriptions-before-budgets-plaid-trial.md) | 2026-10-13 |
| 20 | [Sliding sessions, remember me, and log out everywhere](0020-sliding-sessions-and-log-out-everywhere.md) | 2026-10-13 |
| 21 | [Accounts, signed transactions and category kinds](0021-accounts-signed-transactions-and-category-kinds.md) | 2026-10-14 |

Bugs and surprises found along the way are in [lessons learned](../lessons-learned.md).
