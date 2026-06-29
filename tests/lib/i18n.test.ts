import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { getLangFromStorage, saveLangToStorage, getTranslation, TRANSLATIONS } from "../../lib/i18n";

beforeEach(() => localStorageMock.clear());

describe("getLangFromStorage", () => {
  it("returns ko when nothing stored", () => {
    expect(getLangFromStorage()).toBe("ko");
  });
  it("returns stored lang", () => {
    localStorageMock.setItem("seokminal_lang", "en");
    expect(getLangFromStorage()).toBe("en");
  });
  it("returns ko for unknown stored value", () => {
    localStorageMock.setItem("seokminal_lang", "fr");
    expect(getLangFromStorage()).toBe("ko");
  });
});

describe("saveLangToStorage", () => {
  it("saves lang to localStorage", () => {
    saveLangToStorage("de");
    expect(localStorageMock.getItem("seokminal_lang")).toBe("de");
  });
});

describe("getTranslation", () => {
  it("returns ko string for known key", () => {
    expect(getTranslation("nav.dashboard", "ko")).toBe(TRANSLATIONS["nav.dashboard"]["ko"]);
  });
  it("returns en string for known key", () => {
    expect(getTranslation("nav.research", "en")).toBe(TRANSLATIONS["nav.research"]["en"]);
  });
  it("returns key itself when key missing", () => {
    expect(getTranslation("nonexistent.key", "ko")).toBe("nonexistent.key");
  });
});
