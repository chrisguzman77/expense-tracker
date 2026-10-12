# 16. Monitor backups with healthchecks.io

- **Date:** 2026-10-12
- **Status:** Accepted

## Context

The most dangerous backup failures are silent: the VM is off, the container died, or cron
never fired. None of these produce an error message, because nothing runs.

## Decision

Use healthchecks.io, a "dead man's switch". Each backup and restore drill pings it at start,
on success, and on failure. It emails when a failure ping arrives **or when an expected ping
does not arrive**: one check expects a backup every day (3 hours of grace), the other a drill
every 31 days (1 day of grace). It runs outside the home network, so it still alerts when the
whole house is offline. The free plan covers this.

## Alternatives considered

- **Grafana (Grafana Cloud).** Its built-in checks probe a URL from the internet, and this app
  is deliberately unreachable from the internet. The proper approach is pushing a "last
  successful backup" timestamp metric through an agent on the VM and alerting when it gets
  stale. That's an industry-standard pattern, but it means an agent, script changes, alert
  rules and new tests. Planned as a later project covering app dashboards as well.
- **Umami.** Website analytics; it has no alerting on missing events.

## Consequences

- No code changes: the backup scripts already speak healthchecks.io's ping protocol.
- If monitoring moves to Grafana later, the scripts' ping calls change and their tests with them.
