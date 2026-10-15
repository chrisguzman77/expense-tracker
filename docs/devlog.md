# Devlog

A dated log of working sessions: what I set out to do, what happened, and what was decided.
The reasoning behind decisions lives in [decision records](decisions/); bugs and surprises
live in [lessons learned](lessons-learned.md). Entries before October are reconstructed from
git history.

## 2026-09-01 to 2026-09-10 — Backend MVP

Built by hand following a guided walkthrough: scaffolding, a walking skeleton (health check,
Postgres, Docker Compose), email/password auth, then categories, expenses and a monthly
summary.

- Auth stores a JWT in an httpOnly cookie; `/api/auth/me` is the only auth state
  ([decision 2](decisions/0002-jwt-in-httponly-cookie.md)).
- passlib broke with bcrypt 4, so passwords are hashed with bcrypt directly
  ([decision 3](decisions/0003-bcrypt-without-passlib.md)).
- Money is a decimal string end to end ([decision 4](decisions/0004-money-as-decimal-strings.md)).
- A linter autofix deleted a side-effect import and produced a drop-all-tables migration,
  caught before it ran ([lessons](lessons-learned.md#backend)).

PRs #1–#3.

## 2026-10-01 — Picking the project back up

Verified the project notes against the repository. The backend matched; the frontend was
further behind than the notes said (no API client yet, starter page still in place).

- Created the long-lived `dev` branch for the frontend phase
  ([decision 6](decisions/0006-branching-and-merging.md)).
- Chose `openapi-fetch` over a hand-written fetch wrapper, since the API types were already
  generated from the backend ([decision 5](decisions/0005-generated-api-types-and-openapi-fetch.md)).

## 2026-10-02 — API client plumbing

Generated the TypeScript types, built the `openapi-fetch` client with an `unwrap` helper for
TanStack Query, and set up Vitest. Another project on the laptop already held port 5432, so
local Postgres moved to 5434. PRs #4–#5.

## 2026-10-06 — The whole frontend in a day

Auth shell (login, register, logout, protected routes), then the categories, expenses and
monthly summary screens, each test-first with MSW and React Testing Library. The local API
moved to port 8010 for the same port-conflict reason.

- Smoke-testing the summary against the real backend exposed a SQL bug: categories with
  expenses only in other months disappeared. Fixed by moving the date filter from `WHERE`
  into the outer join's `ON` clause, test first.
- Landed `dev` in `main` with a merge commit to keep each feature's history.

PRs #6–#12.

## 2026-10-07 — Containers and CI

Frontend Dockerfile and nginx (SPA routing, asset caching, `/api` proxy). nginx returned 502
for a few seconds at startup until the API got a healthcheck. CI now runs Ruff, migrations
plus `alembic check`, pytest, ESLint, Vitest, the build, a type-drift check and image builds;
`alembic check` was proven to catch the old import bug. Branch protection requires the checks.
PRs #13–#14. ([decision 7](decisions/0007-ci-quality-gates.md))

## 2026-10-08 — Designing production

Chose TLS through `tailscale serve` over mounting certificates into nginx, public images on
GHCR (the repo is public and images hold no secrets), and publishing only from `main`, tagged
by commit for rollbacks. Production compose got a one-shot migration service the API waits on.
PR #15. ([decisions 8–10](decisions/))

## 2026-10-09 — First publish

Landing `dev` in `main` published the first images; they came out public without any manual
step. Wrote the VM setup guide (#17). The laptop's disk filled up and Docker went read-only;
pruning build cache recovered 17 GB.

## 2026-10-11 — "Why would one command delete my database?"

A question about `docker compose down -v` turned into a look at how the industry protects
production data, a tour of hosting options (cloud VMs, managed platforms), and a new
direction: grow this into a personal finance app with bank sync, budgets and subscription
detection ([decision 13](decisions/0013-personal-finance-roadmap.md)). Data safety comes first.

- Designed it through brainstorming: Cloudflare R2 for offsite storage, restic in a backup
  container, healthchecks.io for alerts, monthly restore drills. Wrote a spec and a plan.
- Executed the plan with subagents, one task at a time, each reviewed. Reviews caught that
  retention would never have pruned (random container hostnames) and a flaky test caused by
  `grep -q` under `pipefail`.
- Realized the reasoning behind the project only lived in chat, so wrote 13 decision records
  and a lessons-learned log.

## 2026-10-12 — Finishing data safety and going live

Finished the production compose and docs tasks. The final whole-branch review found problems
in the manual procedures someone would follow under pressure: a non-atomic restore, rollbacks
to older builds that would break every service, no upgrade path for an existing VM, and my own
"take a safety backup first" advice, which could have pruned the snapshot being restored. All
fixed. Merged data safety (#18) and the decision records (#19), and landed `dev` in `main`
(#20), which published the backup image.

Then deployment:

- Hosting: a dedicated VM on the home Proxmox server rather than sharing the public-facing
  portfolio VM or moving to the cloud ([decision 14](decisions/0014-dedicated-vm-on-proxmox.md)).
- iPhone: a home-screen web app, since native iPhone apps can't be installed from a website
  outside the EU ([decision 15](decisions/0015-mobile-access-as-home-screen-web-app.md)).
- Monitoring: healthchecks.io now, Grafana as a later project
  ([decision 16](decisions/0016-backup-monitoring-with-healthchecks.md)).
- Created the VM from a cloud-init template, installed Tailscale and Docker, set up the R2
  bucket and a bucket-scoped token, the encryption key (saved to a password manager), and two
  healthchecks.io checks. First backup and restore drill passed. The app is live at its
  Tailscale address, reachable only from my own devices.
- Snags along the way are in [lessons learned](lessons-learned.md#going-live): a reboot that
  needed the guest agent, a missing `s3:` prefix, and making sure Tailscale Funnel stayed off.

Closing registration: the app had one account but still accepted sign-ups from any device on
the tailnet. Registration is now off unless `ALLOW_REGISTRATION` is set, returning 403
otherwise; the setup guide opens it only for the first sign-up
([decision 17](decisions/0017-registration-closed-by-default.md)).

**Next:** confirm the first scheduled 3 a.m. backup; phone polish (icons, full-screen,
layout); then piece 2, accounts and transactions with CSV import.

## 2026-10-12 — Rolling out closed registration; designing the redesign

Rolled the closed-registration release out to the VM. The first attempt ran the commands from
the home directory instead of `~/expense-tracker`, so compose found no `.env`. Nothing changed:
the production compose file requires every secret with `${VAR:?}`, so compose refused to start
instead of running with blank secrets. Re-ran from the right directory; the closure probe
returned `403`.

A false alarm along the way: my account seemed to be missing when logging in from my phone. It
was a typo on the phone keyboard. Worth remembering that checking the simple explanation first
(log in again, carefully) beats digging into the database.

Then designed the UI redesign with mockups in a browser companion: a bold gradient style,
category colors and emoji, a donut breakdown that can collapse, separate screens for adding and
viewing an expense, a responsive layout for the laptop, light/dark/system themes, and a
home-screen icon so the app launches full screen on the iPhone. Wrote the
[spec](superpowers/specs/2026-10-12-ui-redesign-design.md) and a four-PR plan. Longer phone
sessions are deliberately a separate, later project because they change auth.

## 2026-10-13 — The redesign

Built the redesign in four pull requests, each task implemented by one agent and reviewed by
another before the next started:

1. Categories got a color (one of ten named palette colors, checked by the API) and an emoji,
   with a migration that gives existing categories a default (#25).
2. The foundation: colors as CSS variables with a light/dark/system theme, a small set of
   hand-built components with no UI library
   ([decision 18](decisions/0018-hand-built-ui-components.md)), a bottom tab bar that moves into
   the header on a laptop, a Settings screen, and the restyled login (#26).
3. The screens: the Expenses tab with this month's total and a collapsible donut breakdown,
   separate screens for adding and viewing an expense, an emoji and color picker for categories,
   and a Summary tab with month arrows (#27).
4. The home-screen app: an icon, a web app manifest, the iPhone tags for full-screen launch, and
   nginx headers so the installed app picks up new versions
   ([decision 15](decisions/0015-mobile-access-as-home-screen-web-app.md), now accepted).

Things found along the way, all in [lessons learned](lessons-learned.md): negative
amounts would have been off by a dollar, Vitest silently reads stylesheets as empty strings,
and nginx didn't know what a `.webmanifest` file was.

The final review of the whole project caught two bugs that every per-task review had missed,
because each task tested its own screen in isolation:

- Creating a category from the add-expense screen came back showing one category while the form
  would have saved the expense under the new one. The category list wasn't refetched because no
  screen was showing it. Fixed, with a test that walks the whole flow across both screens.
- On the iPhone home-screen app the clock and battery would have disappeared on the white
  pushed screens, because that status bar style always draws white text. Those screens now paint
  the strip behind it with the gradient.

It also caught that the runbook said to take a backup before a migration *after* the deploy
commands. Moved it first.

Checked every screen at iPhone width in light and dark, and at laptop width, with headless
Chrome driven over the DevTools protocol and a throwaway local account. 79 frontend and 18
backend tests pass.

**Next:** deploy (backup first, then pull and up), install on the iPhone, then longer sessions
on trusted devices, the password-length fix, and piece 2, accounts and transactions with CSV
import.

## 2026-10-13 — Live on the phone; reordering the roadmap

Deployed the redesign: took a backup first (the release added two columns), then pulled and
restarted. The migration ran cleanly. Added the app to my iPhone home screen; it launches full
screen with the donut icon.

Then revisited the Rocket Money goal: connect my bank and cards once and see forgotten
subscriptions straight away. Learned how that works: an aggregator such as Plaid handles the
bank login and returns the past transaction history on the first connect, and the app looks for
charges from the same merchant at a steady rhythm. Researched aggregators for my own banks.
Plaid's free Trial plan (10 connections, no time limit in its docs) looks like the fit, with CSV
import as the fallback. Moved subscription detection ahead of budgets
([decision 19](decisions/0019-subscriptions-before-budgets-plaid-trial.md)).

**Next:** longer sessions on trusted devices, the password-length fix, then accounts and
transactions.

## 2026-10-13 — Staying logged in on the phone

The home-screen app logged out every hour because the login token expired 60 minutes after
login, whatever I was doing. Designed the fix through brainstorming:

- Sessions slide: each request renews the token, so I'm only logged out after a stretch of not
  using the app.
- A "Keep me logged in" checkbox picks the stretch: 30 days, or 60 minutes with a cookie that
  ends when the browser closes.
- "Log out everywhere" in Settings, for a lost phone.
- Any ended session now lands on the login screen instead of showing a raw error.

The main choice was how to end a 30-day session early. A server-side sessions table would have
allowed ending one device at a time; I kept the existing token and added a version number to
each user, which "log out everywhere" bumps. Smaller, and enough for one person with two
devices ([decision 20](decisions/0020-sliding-sessions-and-log-out-everywhere.md)).

Built in two pull requests, each task implemented and reviewed by separate agents (#31 for the
backend). Things found along the way:

- The generated TypeScript types made the new optional `remember` field required, the second
  time a field with a default has done that ([lessons](lessons-learned.md#frontend)).
- Prototyping the logout redirect while planning showed React Query would retry a 401 three
  times first, delaying the redirect by about seven seconds. 401s are no longer retried.
- The final review caught that my decision record overstated the security: with sliding and no
  cap, a copied token lasts as long as it keeps being used, not "up to 30 days". Corrected
  ([lessons](lessons-learned.md#backend)).
- A few unrelated frontend tests timed out when the laptop was overloaded (load average around
  24 on 8 cores); they pass on their own and in CI.

Checked the login checkbox and the Settings confirmation at phone width in both themes, and ran
the whole flow against the local API with curl: two logins, one "log out everywhere", both
sessions ended.

**Next:** deploy (backup first, since this adds a column), log in again on each device and tick
the box on the phone; then the password-length fix and accounts and transactions.

## 2026-10-13 — Rolling out longer sessions; the password-length fix

Landed both pull requests in `main` (#33) and deployed: took a backup first because the release
adds a column, then pulled and restarted. Every device was logged out once, as expected, since
older tokens carry no version. Logged in again, ticking "Keep me logged in" inside the phone's
home-screen app.

Then closed an issue open since the first week. bcrypt only reads 72 bytes of a password and
the current version raises an error on anything longer. Checking the code turned up more than
the notes said: registration allowed 120 characters, and login passed any length straight to
bcrypt, so typing a very long password on the login page caused a server error. Registration
now rejects more than 72 bytes (counted in bytes, since an emoji is four), the form says so
before sending, and login treats a longer password as simply wrong. Tests first, including one
with 19 emoji: 19 characters, 76 bytes.

**Next:** accounts and transactions with CSV import.

## 2026-10-14 — Accounts, money in, and category kinds

Started piece 2 of the roadmap and split it first: accounts and transactions now (2a), CSV
import later (2b). Each half is about the size of the redesign, and 2a can go live before
import exists.

The design questions were about money coming in, which real bank data is full of: refunds,
paychecks, and card payments that show up on two accounts at once
([decision 21](decisions/0021-accounts-signed-transactions-and-category-kinds.md)):

- One signed amount, negative for money out, as on a bank statement. Spending is minus the
  sum, so a $20 return cancels part of a $50 purchase.
- Every category has a kind: spending, income or transfer. Only spending is summed, so a
  paycheck or a card payment filed under the right category stays out of the totals.
- Every transaction belongs to an account (a name and a type, no balance yet), and "expenses"
  became "transactions" everywhere. Accounts get a fourth tab.

Production had no expenses yet, but the migration still moves existing rows properly (my local
data has some): it renames the table and everything Postgres leaves behind on a rename (the id
sequence, the constraints, the index), puts each user's rows in a "Cash" account, and flips
their sign. A test runs it against a scratch database: upgrade, downgrade, upgrade again, a user
who already had a "Cash" account, and two users with a decoy account.

Three pull requests (#35, #36, #37), each task built and reviewed by separate
agents. Things caught along the way:

- A new test printed one unfamiliar warning. It turned out a rollback in the code under test
  was also undoing the test's own setup, so the test was checking less than it seemed
  ([lessons](lessons-learned.md#backend)).
- While planning: once refunds exist, the Summary page could show a category at 167%.
- The whole-branch review noticed the migration test only used one user, so it couldn't catch
  rows landing in someone else's account. Now it uses two, and fails if the per-user condition
  is removed.
- CI caught what every review missed: the monthly restore drill on the server checks that a
  restored backup contains an `expenses` table. After this release it would have failed every
  month, and it would have blocked publishing the images
  ([lessons](lessons-learned.md#backups)).

**Next:** land 2a (backup first: three migrations), reload the home-screen app, create my real
accounts; then CSV import.

## 2026-10-14 — Rolling out accounts

Landed 2a in `main` (#38), took a backup (three migrations), then deployed. The rollout steps
Claude gave me started with `git pull`, which failed with "not a git repository": the server's
folder holds only `compose.yaml` and `.env`, and the images carry the code. The runbook already had it right
(`docker compose pull`, then `up -d`). The `migrate` step applied all three migrations and the
API came up healthy.

Then I ran the restore drill by hand, and it failed: "table missing from restore: accounts".
Nothing was wrong with the backup. The drill restores the newest snapshot, and the newest one
was the backup taken just before the deploy, from before the `accounts` table existed. A fresh
backup, then the drill again: passed. The runbook now says to back up again before a manual
drill after a release with a migration
([lessons](lessons-learned.md#backups)).

The phone also showed "server not found" for a while, in Safari and in the home-screen app,
then started working again. I never found the cause; Tailscale on the phone is the likeliest.

**Next:** CSV import, transaction editing and duplicate detection (2b).

## 2026-10-14 — Dropping CSV import; editing everything

The next piece was meant to be CSV import. Before starting, I asked whether it was needed at
all: once the bank connection exists, I'd import a file once or twice and never again. It's
not needed, so it's dropped as a planned piece. Decision 19 had already kept it only as the
fallback if Plaid's free plan falls through. The rest of that piece (editing, bank
descriptions, duplicate detection) is needed whatever the data source, so it moved into bank
sync, which is now three parts: 3a (a coverage check plus editing), 3b (connecting) and 3c
(syncing).

Reading Plaid's docs for the coverage check turned up things that shape the design:

- History is chosen when an account is connected (up to two years) and can't be extended
  later without reconnecting, which costs one of the Trial's ten lifetime connections. So the
  first connection asks for everything.
- Capital One only gives Plaid 90 days of history. That's too short to spot yearly
  subscriptions on those cards, and it's the one place a CSV import might still earn its keep.
- Plaid normally tells an app about new transactions by calling it, but this app is only
  reachable on my private network. It will check on a schedule instead.

Then editing, which the app never had: transactions (every field), categories (name, kind,
color, emoji) and accounts (name and type). Each create form became a component shared with a
new edit screen. The edit endpoints take the whole record (PUT), because the forms hold every
field anyway.

Two pull requests (#40 and this one), each task built and reviewed by separate agents. Things
caught along the way:

- A lint rule forbids exporting plain functions from component files (it keeps hot reload
  working). The first implementation switched the rule off for one line. Since that would
  have been the only suppression in the codebase, the helper moved to `src/lib/` instead, and
  the plan was updated so later tasks didn't need the same exception.
- The final review noticed the spec described the shared form differently from what was
  built, and that the commands I'll run for the coverage check passed the secret key on
  curl's command line, where other programs can briefly see it. The key now goes in through
  standard input.
- The second review pointed out that the account screen's Edit and Delete buttons sit below
  its whole transaction list. With a few hand-entered rows that's fine, but once a bank
  account brings two years of history they'd be hundreds of rows down, so they're worth
  moving up before connecting accounts.

**Next:** run the coverage check against Plaid's sandbox; then connecting accounts (3b).

## 2026-10-15 — Plaid checks out

Ran the coverage check that decision 19 asked for before building on Plaid
([research note](research/plaid-coverage.md)). Signing up had a "personal use" option, and the
free Trial was granted on the spot. A search of Plaid's sandbox found all four of my banks with
Transactions. The dashboard's OAuth page said no action is needed on the Trial for bank logins.
The only rough edges are at Capital One: 90 days of history through Plaid and no on-demand
refresh. Its own download seems to go back further, so a one-time import of older history stays
possible. My Discover card hasn't moved to a Capital One login yet, which matters for when to
connect it.

That settles the provider ([decision 22](decisions/0022-plaid-for-bank-sync.md)): Plaid for bank
sync, with CSV import dropped as a planned piece.

A small one: the check's shell commands broke the first time I pasted them, because the
terminal wrapped a long line and left a `\` on its own. The version in the spec now ends lines
in pipes, so wrapping can't break it.

**Next:** connecting accounts (3b), starting in the sandbox with the two open questions: whether
my tailnet-only address works as Plaid's redirect, and what the bank login does inside the
home-screen app.

## 2026-10-15 — Edit in the header

A small interface fix before connecting banks ([spec](superpowers/specs/2026-10-15-edit-in-header-design.md)).
The account screen had its Edit and Delete buttons below the account's whole transaction list,
which would have put them hundreds of rows down once a bank brings two years of history.

Deleting was also done three different ways: buttons under a transaction, buttons under an
account's list, and a trash icon on each category row that deleted in one tap with no
confirmation. Now there is one pattern, the usual one on an iPhone:
- **Edit** is a link in the screen's header, so it never scrolls away.
- **Delete** sits at the bottom of the edit screen and always asks first. One shared component
  holds that confirmation instead of three copies.
- Category and account rows get a chevron (›), so it's clear they open something. Transaction
  rows keep their amount on the right instead.

Two details came along with it. Editing can now move a transaction to another account or
category, so the "still has transactions" message says "move or delete them first". And a
deleted record no longer flashes "not found" for a moment before the screen goes back to the
list.

Four tasks, each built and reviewed by separate agents; no review asked for changes.

**Next:** connecting accounts (3b).
