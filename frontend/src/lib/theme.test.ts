import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getThemePref, resolveTheme, setThemePref, watchSystemTheme } from "./theme";

type Listener = () => void;

function stubSystemDark(initial: boolean) {
  const listeners: Listener[] = [];
  const mq = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, l: Listener) => listeners.push(l),
    removeEventListener: (_: string, l: Listener) => listeners.splice(listeners.indexOf(l), 1),
  };
  vi.stubGlobal("matchMedia", () => mq);
  return {
    set(dark: boolean) {
      mq.matches = dark;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("defaults to system when nothing is stored", () => {
    expect(getThemePref()).toBe("system");
  });

  it("stores an explicit choice and applies it", () => {
    setThemePref("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(getThemePref()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    setThemePref("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system from the OS setting", () => {
    stubSystemDark(true);
    expect(resolveTheme("system")).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("treats system as light when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveTheme("system")).toBe("light");
  });

  it("follows OS changes only while the preference is system", () => {
    const os = stubSystemDark(false);
    setThemePref("system");
    const stop = watchSystemTheme();

    os.set(true);
    expect(document.documentElement.dataset.theme).toBe("dark");

    setThemePref("light");
    os.set(false);
    os.set(true);
    expect(document.documentElement.dataset.theme).toBe("light");

    stop();
    expect(os.listenerCount()).toBe(0);
  });
});
