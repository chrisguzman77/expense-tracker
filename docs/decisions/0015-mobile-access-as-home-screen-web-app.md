# 15. Mobile access through a home-screen web app

- **Date:** 2026-10-12
- **Status:** Accepted (implemented in the UI redesign, 2026-10)

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

## Implementation notes

- A web app manifest (`short_name` "Expenses", `display: standalone`), a 180px Apple touch
  icon, and Apple meta tags for full-screen launch with a translucent status bar.
- **No service worker.** iOS launches a home-screen app full screen without one. Its main use
  is offline caching, which this app can't use (it needs its server), and a cached app shell
  can keep serving an old version after a deploy.
- Instead, nginx sends `Cache-Control: no-cache` for `index.html` and the manifest, so the app
  checks for a new version on every launch. Hashed files under `/assets/` stay cached for a
  year; their names change with every build.
- A home-screen app keeps its own cookies, separate from Safari, so it needs its own login once.
