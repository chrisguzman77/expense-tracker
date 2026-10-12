# 14. Host the app on its own VM on the home Proxmox server

- **Date:** 2026-10-12
- **Status:** Accepted

## Context

The production stack needs a Linux machine with Docker that is reachable only over Tailscale
(record 8). The home Proxmox server already runs several VMs, including a public-facing
portfolio website and a malware-analysis lab. It has 15 GB of RAM, with about 4 GB available
and some swap already in use, and plenty of free disk.

## Decision

Run the app on a new, dedicated VM on the same Proxmox server:

- Cloned from an existing Ubuntu 24.04 cloud-init template, with 1.5 GB of RAM (ballooning
  down to 1 GB), 2 cores and a 20 GB disk.
- On the home network bridge, not the lab's isolated bridge, so it never shares a virtual
  network with VMs that run malware.
- Reached from other devices only through Tailscale.

## Alternatives considered

- **Share the portfolio VM.** Lightest option (about 300 MB of extra RAM instead of about
  1 GB). Rejected because the portfolio is the internet-facing machine: a compromise there
  would put the attacker on the same machine as the financial database, the backup
  credentials and, later, bank tokens. Docker isolation is not a strong security boundary.
- **A free cloud VM.** Google Cloud's e2-micro (1 GB of RAM, tight for Postgres) or Oracle
  Cloud's free ARM VMs (generous, but needs ARM images and Oracle has reclaimed idle free
  instances). Both put the financial data on someone else's hardware.
- **A paid VPS** (about $4–6 a month). The most reliable option and needs no code changes;
  not needed while the home server has room.
- **A managed platform** (Render, Railway) with managed Postgres. Would make the app public
  and replace most of the deploy and backup design.

## Consequences

- Marginal cost is a few watts of electricity.
- Memory on the host is the constraint; shutting down the lab VMs when they aren't in use
  frees most of it.
- Home power or internet outages take the app offline. Backups are offsite, so data survives.
