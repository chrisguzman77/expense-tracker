# Lessons learned

Bugs, surprises and near misses from building this project: what happened, why, what changed,
and the takeaway. Newest last. Design decisions themselves are in [decisions/](decisions/).

## Backend

**A linter autofix generated a drop-all-tables migration** (backend phase, September 2026)
- *What happened:* Ruff's unused-import autofix (F401) deleted `import app.models` from
  `alembic/env.py`. The import looked unused but registers every model on `Base.metadata`.
  The next `alembic revision --autogenerate` saw no models and wrote a migration dropping
  every table.
- *Fix:* `# noqa: F401` on the import, and CI now runs `alembic check`, which fails if models
  and migrations disagree. Verified by deleting the import and watching the check fail.
- *Takeaway:* imports with side effects are invisible to linters. Read every generated
  migration before applying it, and let CI catch the rest.

**passlib broke with bcrypt 4** (2026-09-03)
- *Fix:* call `bcrypt` directly. See [decision 3](decisions/0003-bcrypt-without-passlib.md).
- *Follow-up (fixed 2026-10-13):* bcrypt rejects passwords over 72 bytes, but registration
  allowed 120 characters, and login passed any length to bcrypt, so a long password typed on
  the login page caused a 500. The limit is now checked in bytes at registration, and login
  treats a longer password as wrong. A 72-character cap wouldn't have been enough: an emoji is
  4 bytes.

**The monthly summary dropped categories** (found 2026-10-06, PR #11)
- *What happened:* categories whose expenses were all in other months vanished from a month's
  summary instead of showing a total of 0.
- *Cause:* the date filter sat in the `WHERE` clause of a `LEFT JOIN`. An unmatched category
  survives a left join with NULLs, but a matched category whose rows are then filtered out by
  `WHERE` disappears entirely.
- *Fix:* move the date range into the `JOIN ... ON` condition. Regression test added first.
- *Takeaway:* with outer joins, conditions on the optional side belong in `ON`, not `WHERE`.

**"Up to 30 days" was wrong: a sliding session never runs out while it's used** (final review, 2026-10-13)
- *What happened:* the first draft of [decision 20](decisions/0020-sliding-sessions-and-log-out-everywhere.md)
  said a copied token stays valid for up to 30 days. But every request reissues the token, and
  there is no absolute cap, so a copy that keeps being used never expires.
- *Fix:* the record now says so, and that only log out everywhere ends it.
- *Takeaway:* "expires after N days" and "expires after N idle days" are different promises.
  State which one a design makes, especially where security depends on it.

**Reissuing cookies on every response undoes a logout in a narrow race** (final review, 2026-10-13)
- *Cause:* a request already in flight when Log out is pressed can come back after the logout
  response with a fresh `Set-Cookie`, re-creating the session. Before sliding sessions, nothing
  reissued cookies, so deleting one was final.
- *Impact:* a window of milliseconds; log out everywhere is immune because the reissued token
  carries the old version. Accepted and recorded in decision 20.

**A rollback in the code under test wiped the test's own data** (piece 2a, 2026-10-14)
- *What happened:* the first test of a duplicate account name passed, but printed a new
  SQLAlchemy warning: "transaction already deassociated from connection". Each test runs inside
  one outer transaction that is rolled back at the end. When the service caught the
  `IntegrityError` and called `rollback()`, SQLAlchemy 2 rolled back that outer transaction
  too, silently discarding everything the test had created before the failed insert (here,
  the user and their first account).
- *Why it hadn't shown up:* no earlier backend test reached a service rollback; the duplicate
  category check is only tested in the frontend.
- *Fix:* the test session uses `join_transaction_mode="create_savepoint"`, so the service's
  commits and rollbacks become savepoints inside the test's transaction. The test now also
  checks that the first account survives; that assertion failed before the fix.
- *Takeaway:* a new warning in test output is a finding, not noise. Here it was the only sign
  that the test was checking less than it appeared to.

## Frontend

**Test request interceptors didn't see requests** (2026-10-02)
- *Cause:* the API client captured `fetch` when the module loaded, before MSW installed its
  interceptor in the test setup.
- *Fix:* the client looks up `globalThis.fetch` at call time.

**Tests found duplicate elements across test cases** (2026-10-02)
- *Cause:* React Testing Library only cleans up the DOM automatically when Vitest globals are
  enabled; this project doesn't enable them.
- *Fix:* call `cleanup()` in `afterEach` in the shared test setup.

**Negative amounts would have been off by a dollar** (found while planning the redesign, 2026-10-12)
- *Cause:* `toCents("-12.5")` split on the dot and computed `-12 * 100 + 50 = -1150`, adding
  the cents to a negative whole part. Formatting `-50` cents also lost the sign (`-0` prints as
  `0`).
- *Impact:* none yet; amounts are always positive today. Refunds and imported bank
  transactions will be negative.
- *Fix:* handle the sign separately from the digits, with tests for negative values.

**A test read the stylesheet and got an empty string** (found while planning, 2026-10-12)
- *Cause:* Vitest skips CSS processing by default and replaces every CSS import with an empty
  string, including `?raw` imports meant to read the file as text.
- *Fix:* `test.css.include` in the Vite config for `index.css` only.
- *Takeaway:* when a test reads a file, assert something about its content first, so an empty
  read fails loudly instead of passing vacuously.

**A refreshed list wasn't refreshed** (final review, 2026-10-13)
- *Cause:* after creating a category from the new-category screen, `invalidateQueries` only
  refetches queries some component is currently showing; the category list had no observer
  there, so the expense form came back with the old list and the select silently showed a
  different category than the one being saved.
- *Fix:* refetch with `refetchType: "all"` before navigating back, plus a test that walks the
  whole flow across both screens.
- *Takeaway:* per-page tests each start from a fresh fetch; flows that hand state between
  screens need a test that crosses them.

**An optional API field came out required in the generated types** (2026-10-13, twice)
- *Cause:* `openapi-typescript` marks any schema property that has a default as required in
  the TypeScript types. `remember: bool = False` on the login body became `remember: boolean`,
  so the type check failed until the login page sent it. Category `color` and `icon` did the
  same during the redesign.
- *Fix:* the frontend sends the value explicitly; the backend default stays for other clients.
- *Takeaway:* "the existing frontend keeps working" holds at runtime but not at compile time
  when a field with a default is added; plan for the frontend to send it.

## Local development

**Ports already taken by other projects** (2026-10-02 and 2026-10-06)
- Host ports 5432 and 8000 were held by other projects' containers. This project maps
  Postgres to 5434 and runs the API on 8010. Only the host side changed; inside Docker the
  services still use 5432 and 8000.

**A full disk made Docker read-only** (2026-10-09)
- *What happened:* pulls and container starts failed with "read-only file system".
- *Cause:* the Mac's data volume was 99% full; Docker's build cache alone was 34 GB.
- *Fix:* `docker builder prune` freed about 17 GB. It removes only cache, never images,
  containers or volumes. `docker system prune --volumes` would also have deleted stopped
  projects' databases.

## Deployment

**nginx returned 502 right after startup** (2026-10-07)
- *Cause:* compose started nginx as soon as the API container existed, before uvicorn was
  listening.
- *Fix:* an API healthcheck, and nginx waits for `condition: service_healthy`.

**`docker compose down -v` would delete the production database** (2026-10-09)
- *Cause:* `-v` removes the named volumes a compose project declares, and the database lived
  in one.
- *Fix:* an external volume, which compose never removes. See
  [decision 11](decisions/0011-protected-database-volume.md).

**Container images inherited public visibility** (2026-10-09)
- Expected GHCR to create the packages as private. Packages pushed from a workflow and linked
  to a public repository came out public. Checked that the images contain no secrets before
  relying on it.

**The first-time setup guide would have failed on a fresh VM** (found in review, 2026-10-11)
- *Cause:* `docker compose run` starts a service's dependencies. The guide ran
  `docker compose run --rm backup restic init` before the database volume existed, so compose
  tried to start Postgres and stopped at the missing external volume. The recovery-from-VM-loss
  instructions also would have backed up the new, empty database before restoring the real one.
- *First fix, and why it was wrong:* `--no-deps` for `restic init`, on the assumption that
  compose skips the database when told not to start dependencies. Tested in a scratch project
  during the final review: compose still validates every external volume in the file and
  fails. The setup now creates the volume before `restic init`.
- *Takeaway:* a protection that fails loudly also has to be accounted for in every procedure
  that touches it. Runbooks need the same review as code, and a reviewer's "I assumed this
  works" is a test to run, not a fact.

**The documented restore could leave the database half-deleted** (final review, 2026-10-12)
- *Cause:* `pg_restore --clean` drops objects first and restores after. If the restore fails
  partway (a truncated download, a wrong snapshot ID), the live database is left broken.
  Restoring after a bad migration also re-applied the same migration on the next start.
- *Fix:* `--single-transaction`, so a failed restore changes nothing; `set -o pipefail` in the
  restore pipe; a note to roll back `IMAGE_TAG` before restarting after a bad migration.

**A "safety backup" before restoring could delete the restore point** (final review, 2026-10-12)
- *What happened:* the first fix for the restore procedure advised running a normal backup
  before restoring, to keep recent changes.
- *Cause:* that backup ends with retention, which is designed to keep one snapshot per day, so
  it can prune the morning's snapshot, which is exactly the good one the restore needs. In a
  test with a brand-new repository restic kept both, so whether it happens depends on how much
  history exists. An instruction that is only safe sometimes isn't safe.
- *Fix:* the pre-restore safety copy uses its own `pre-restore` tag, which retention never
  prunes and the restore's `latest` ignores.
- *Takeaway:* every new instruction has to be checked against the system's other automatic
  behavior. A fix to one step can quietly break another.

**Rolling back to an older build would have broken every service** (final review, 2026-10-12)
- *Cause:* the backup image shared the app's `IMAGE_TAG`, but no backup image exists for
  commits from before it was introduced, so pulling an older tag failed for the whole stack.
- *Fix:* the backup service has its own `BACKUP_IMAGE_TAG`. See
  [decision 9](decisions/0009-container-images-on-ghcr.md).

**GitHub's API: required checks are updated with PATCH** (2026-10-11)
- `PUT .../protection/required_status_checks` returns 404. The endpoint only accepts `PATCH`.

**nginx didn't know what a `.webmanifest` was** (found while planning, 2026-10-12)
- *Cause:* the `nginx:1.27-alpine` image's MIME table has no entry for `.webmanifest`, so the
  manifest would have been served as `application/octet-stream`.
- *Fix:* an exact-match location for `/manifest.webmanifest` that sets
  `application/manifest+json`. Checked with `curl -I` against the built image.
- *Takeaway:* when adding a new kind of static file, check the `Content-Type` the server
  actually sends.

## Backups

**A failed dump could have been saved as a successful backup** (design, 2026-10-11)
- *Cause:* in `pg_dump | restic backup --stdin`, restic saves whatever bytes arrive, even zero,
  before the shell notices `pg_dump` failed.
- *Fix:* `restic backup --stdin-from-command -- pg_dump ...`, where restic runs the dump itself
  and discards the snapshot if it fails. A test points the backup at a missing database and
  checks that no snapshot appears.

**Retention would never have deleted anything** (found in code review, 2026-10-11)
- *Cause:* `restic forget` groups snapshots by host before applying `--keep-*` rules. Every
  `docker compose run` container, and every redeploy, gets a random hostname, so each snapshot
  formed its own group and was kept forever.
- *Fix:* `restic backup --host expense-tracker`. A test checks all snapshots share that host.

**Comparing row counts in a restore drill gives false alarms** (design review, 2026-10-11)
- Rows legitimately change between the nightly backup and the monthly drill, in both
  directions. The drill now fails only when a table is missing, when a table with live rows
  restores empty, or when the migration version differs.

**Cron jobs ran with an empty environment** (2026-10-11)
- busybox `crond` starts jobs without the container's environment variables, so database and
  storage settings would be missing. The entrypoint saves the environment to a file when the
  scheduler starts, and the jobs load it. A test runs the backup with `env -i` to reproduce
  cron exactly.

**A flaky test caused by `grep -q`** (2026-10-11)
- *What happened:* a check for a healthcheck ping failed once, then passed on rerun.
- *Cause:* the test script uses `set -o pipefail`. In `docker logs ... | grep -q pattern`,
  `grep -q` exits at the first match; the still-writing producer gets SIGPIPE, and pipefail
  turns that into a failure even though the pattern was found.
- *Fix:* capture output into a variable first, then grep it. Applied to every such pipe.
- *Takeaway:* under `pipefail`, never pipe into `grep -q`.

**ShellCheck disagreed between laptop and CI** (2026-10-11)
- The CI runner's preinstalled ShellCheck was newer and flagged code the local version
  accepted. CI and local runs now use the same pinned container, `koalaman/shellcheck:v0.11.0`.

## Going live

**`qm reboot` timed out on a brand-new VM** (2026-10-12)
- *Cause:* the Ubuntu cloud-init template has Proxmox's guest agent option enabled, so Proxmox
  asks an agent inside the VM to reboot it. The cloud image doesn't ship that agent.
- *Fix:* `qm stop` and `qm start` for the first restart, then install `qemu-guest-agent` in the
  VM. The setup guide now includes it.

**Couldn't reach the new VM from outside the house** (2026-10-12)
- *What happened:* the new VM had no Tailscale yet, and jumping through another machine's
  Tailscale address failed with "connection refused" (that machine doesn't accept SSH).
- *Fix:* log in from the Proxmox host's own shell, which is on the home network. The VM only
  trusted the laptop's key, so the Proxmox host's public key was added through cloud-init and
  the VM restarted to pick it up. Installing Tailscale was then the first thing done inside it.

**restic said "invalid backend"** (2026-10-12)
- *Cause:* the repository address was pasted as `https://...r2.cloudflarestorage.com/bucket`.
  restic needs the protocol in front: `s3:https://...`.
- *Takeaway:* the backup variables are named `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
  even though nothing uses Amazon. S3 is Amazon's storage protocol, and R2 and most other
  providers speak it, so restic's S3 support uses the same variable names for all of them.

**The backup container listed port 5432** (2026-10-12)
- The backup image is built on the Postgres image, which declares port 5432. `docker compose ps`
  shows it, but nothing publishes it to the host; only nginx has a host port. Cosmetic.

**Enabling Tailscale Serve also offered Funnel** (2026-10-12)
- *What happened:* the first `tailscale serve` asked to enable the feature in the admin console,
  and Funnel was enabled there too.
- *Why it matters:* Serve shares a service with your own devices; Funnel publishes it to the
  whole internet. This app has open registration, so a public address would let anyone sign up.
- *Check:* `tailscale serve status` and `tailscale funnel status` both said `(tailnet only)`, so
  the app was not public. Funnel being allowed on the tailnet doesn't turn it on for a machine.

## Closing registration

**The check that registration was closed could have created an account** (final review, 2026-10-12)
- *What happened:* the setup guide verified closure by posting a valid sign-up and expecting
  `403`. If registration were still open (an older image still running, or the toggle line not
  removed), that "check" would have registered a real user in the production database.
- *Fix:* the probe posts an empty body. The registration gate runs before request validation,
  so a closed endpoint answers `403` and an open one answers `422`; neither can create anything.
- *Takeaway:* a verification step should be unable to cause the problem it checks for.

**A default that every test overrides is untested** (final review, 2026-10-12)
- The test fixture forces registration open so existing tests keep working, which meant
  flipping the shipped default to "open" would have left the whole suite green. A one-line test
  now pins the default by reading the setting's declared default, not a live settings object,
  so the developer's own `.env` can't affect it.
