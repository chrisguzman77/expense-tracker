import { describe, expect, it } from "vitest";
import html from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";

const pngs = Object.keys(import.meta.glob("../public/*.png"));

describe("home-screen app", () => {
  it("links the manifest and sets the iOS home-screen tags", () => {
    for (const tag of [
      '<link rel="manifest" href="/manifest.webmanifest"',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png"',
      '<meta name="apple-mobile-web-app-capable" content="yes"',
      '<meta name="mobile-web-app-capable" content="yes"',
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"',
      '<meta name="apple-mobile-web-app-title" content="Expenses"',
      '<meta name="theme-color"',
      "viewport-fit=cover",
      "<title>Expense Tracker</title>",
    ]) {
      expect(html).toContain(tag);
    }
  });

  it("launches full screen under the name Expenses", () => {
    expect(JSON.parse(manifestText)).toMatchObject({
      name: "Expense Tracker",
      short_name: "Expenses",
      display: "standalone",
      start_url: "/",
      scope: "/",
    });
  });

  it("points at icon files that exist, including a maskable one", () => {
    const manifest = JSON.parse(manifestText) as { icons: { src: string; purpose?: string }[] };
    for (const icon of manifest.icons) expect(pngs).toContain(`../public${icon.src}`);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(pngs).toContain("../public/apple-touch-icon.png");
  });
});
