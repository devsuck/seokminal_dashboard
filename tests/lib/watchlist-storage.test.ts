import { describe, it, expect, beforeEach } from "vitest";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, DEFAULT_SYMBOLS,
} from "../../lib/watchlist-storage";

describe("watchlist-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns DEFAULT_SYMBOLS when storage is empty", () => {
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("returns DEFAULT_SYMBOLS on corrupt JSON", () => {
    localStorage.setItem("nautilus:watchlist", "NOT_JSON{{");
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("returns DEFAULT_SYMBOLS when stored array is empty", () => {
    localStorage.setItem("nautilus:watchlist", "[]");
    expect(getWatchlist()).toEqual(DEFAULT_SYMBOLS);
  });

  it("adds a symbol to the list", () => {
    addToWatchlist("TSLA.NASDAQ");
    expect(getWatchlist()).toContain("TSLA.NASDAQ");
  });

  it("prevents duplicate symbols", () => {
    addToWatchlist("TSLA.NASDAQ");
    addToWatchlist("TSLA.NASDAQ");
    expect(getWatchlist().filter(s => s === "TSLA.NASDAQ")).toHaveLength(1);
  });

  it("removes a symbol", () => {
    addToWatchlist("TSLA.NASDAQ");
    removeFromWatchlist("TSLA.NASDAQ");
    expect(getWatchlist()).not.toContain("TSLA.NASDAQ");
  });

  it("isInWatchlist: true when present", () => {
    addToWatchlist("TSLA.NASDAQ");
    expect(isInWatchlist("TSLA.NASDAQ")).toBe(true);
  });

  it("isInWatchlist: false when absent", () => {
    expect(isInWatchlist("UNKNOWN.XYZ")).toBe(false);
  });
});
