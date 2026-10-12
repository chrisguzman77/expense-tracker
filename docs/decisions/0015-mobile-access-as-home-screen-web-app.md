# 15. Mobile access through a home-screen web app

- **Date:** 2026-10-12
- **Status:** Proposed (polish work not yet scheduled)

## Context

The app should be usable from an iPhone like any other app.

## Decision

Use the existing web app on the phone: Tailscale connected, the app's `ts.net` address opened
in Safari, then **Add to Home Screen**. A small frontend task will make it feel native: a web
app manifest, app icons, full-screen launch, and a check of every screen at phone width.

## Alternatives considered

- **A native iOS app on the App Store.** A separate codebase plus a $99-a-year Apple developer
  account, for no feature the roadmap needs.
- **Installing a native app from a personal website.** Outside the EU, iPhones only install
  native apps from the App Store. The exceptions don't fit: apps installed from Xcode with a
  free account stop working after 7 days, TestFlight builds expire after 90 days, and the EU's
  web distribution only applies to EU users.

## Consequences

- No App Store, no fees, no expiry; every deploy updates the phone app immediately.
- Tailscale has to be connected on the phone to open the app.
- Deep phone integrations (widgets, reading other apps' data) aren't available; nothing on the
  roadmap needs them.
