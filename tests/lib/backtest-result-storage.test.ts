import { describe, it, expect, beforeEach } from "vitest";
import {
  saveBacktestResult,
  getBacktestResults,
  deleteBacktestResult,
  clearBacktestResults,
  type SavedBacktestResult,
} from "../../lib/backtest-result-storage";
import type { BacktestResponse } from "../../lib/api";

const BASE_RESULT: BacktestResponse = {
  sharpe_ratio: 1.5,
  sortino_ratio: 2.0,
  max_drawdown: -0.12,
  volatility: 0.18,
  beta: 1.1,
  total_pnl: 150,
  total_pnl_pct: 0.15,
  win_rate: 0.55,
  profit_loss_ratio: 1.8,
  avg_win: 50,
  avg_loss: -28,
  bar_count: 100,
  trades: [],
};

const BASE_ENTRY: Omit<SavedBacktestResult, "id" | "timestamp"> = {
  label: "AAPL EMA 10/20",
  instrumentId: "AAPL.NASDAQ",
  start: "2025-01-01",
  end: "2026-01-01",
  strategy: "ema_cross",
  fast: 10,
  slow: 20,
  result: BASE_RESULT,
};

describe("backtest-result-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getBacktestResults returns [] when storage empty", () => {
    expect(getBacktestResults()).toEqual([]);
  });

  it("getBacktestResults returns [] on corrupt JSON", () => {
    localStorage.setItem("seokminal:backtest-results", "NOT{JSON");
    expect(getBacktestResults()).toEqual([]);
  });

  it("getBacktestResults returns [] when stored value is not an array", () => {
    localStorage.setItem("seokminal:backtest-results", JSON.stringify({ foo: "bar" }));
    expect(getBacktestResults()).toEqual([]);
  });

  it("saveBacktestResult persists and returns entry with id and timestamp", () => {
    const saved = saveBacktestResult(BASE_ENTRY);
    expect(saved.id).toMatch(/^bt_\d+_[a-z0-9]{5}$/);
    expect(saved.timestamp).toBeGreaterThan(0);
    expect(saved.label).toBe("AAPL EMA 10/20");
    expect(getBacktestResults()).toHaveLength(1);
  });

  it("saveBacktestResult prepends so newest is first", () => {
    saveBacktestResult({ ...BASE_ENTRY, label: "First" });
    saveBacktestResult({ ...BASE_ENTRY, label: "Second" });
    const results = getBacktestResults();
    expect(results[0].label).toBe("Second");
    expect(results[1].label).toBe("First");
  });

  it("deleteBacktestResult removes by id", () => {
    const saved = saveBacktestResult(BASE_ENTRY);
    deleteBacktestResult(saved.id);
    expect(getBacktestResults()).toHaveLength(0);
  });

  it("deleteBacktestResult does nothing when id not found", () => {
    saveBacktestResult(BASE_ENTRY);
    deleteBacktestResult("nonexistent");
    expect(getBacktestResults()).toHaveLength(1);
  });

  it("clearBacktestResults empties storage", () => {
    saveBacktestResult(BASE_ENTRY);
    saveBacktestResult({ ...BASE_ENTRY, label: "B" });
    clearBacktestResults();
    expect(getBacktestResults()).toHaveLength(0);
  });
});
