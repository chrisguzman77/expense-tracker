# 8. Private access over Tailscale, TLS via `tailscale serve`

- **Date:** 2026-10-08
- **Status:** Accepted

## Context

The app holds personal financial data and only needs to be reachable from my own devices.
Production cookies are `Secure` (record 2), so the site must be served over HTTPS.

## Decision

- The app runs on a Proxmox VM that is reachable only through Tailscale.
- nginx is published on the VM's loopback interface only (`127.0.0.1:8080`). The database and
  API publish no ports at all.
- `tailscale serve` on the VM host terminates HTTPS with a certificate Tailscale issues and
  renews automatically, and proxies to nginx.

## Alternatives considered

- **`tailscale cert` plus TLS in nginx.** Same certificates, but they must be mounted into
  nginx and renewed by a cron job every 90 days; more to maintain.
- **Public cloud hosting** (Vultr, Oracle Cloud, Vercel, Cloudflare), discussed 2026-10-11.
  A cloud VM would work with the same compose file; a separate frontend host would break the
  same-origin cookie design. Kept the homelab to stay free and fully private.

## Consequences

- Nothing listens on a public or LAN interface.
- nginx needs no TLS configuration; certificates renew without intervention.
- Every device that uses the app needs Tailscale installed.
