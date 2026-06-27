import { describe, it, expect, beforeEach } from "vitest";
import {
  saveExperiment, getExperiments, updateExperimentNotes,
  deleteExperiment, clearExperiments, makeExperimentLabel, extractMetrics,
  type ExperimentParams, type ExperimentMetrics,
} from "../../lib/experiment-storage";
import type { BacktestResponse } from "../../lib/api";

const BASE_PARAMS: ExperimentParams = {
  strategy: "ema_cross",
  instrumentId: "AAPL.NASDAQ",
  start: "2025-01-01",
  end: "2026-01-01",
  timeframe: "1D",
  benchmarkId: "",
  fast: 10,
  slow: 20,
};

const BASE_METRICS: ExperimentMetrics = {
  sharpe: 1.5,
  sortino: 2.1,
  maxDrawdown: -0.12,
  winRate: 0.55,
  totalPnlPct: 0.22,
  totalTrades: 43,
  volatility: 0.18,
};

describe("experiment-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getExperiments returns [] when storage empty", () => {
    expect(getExperiments()).toEqual([]);
  });

  it("getExperiments returns [] on corrupt JSON", () => {
    localStorage.setItem("nautilus:experiments", "NOT{JSON");
    expect(getExperiments()).toEqual([]);
  });

  it("saveExperiment persists and returns experiment with id/timestamp/notes", () => {
    const exp = saveExperiment({ label: "Test", params: BASE_PARAMS, metrics: BASE_METRICS });
    expect(exp.id).toMatch(/^exp_\d+_[a-z0-9]{5}$/);
    expect(exp.timestamp).toBeGreaterThan(0);
    expect(exp.notes).toBe("");
    expect(getExperiments()).toHaveLength(1);
  });

  it("saveExperiment prepends (newest first)", () => {
    saveExperiment({ label: "A", params: BASE_PARAMS, metrics: BASE_METRICS });
    saveExperiment({ label: "B", params: BASE_PARAMS, metrics: BASE_METRICS });
    const exps = getExperiments();
    expect(exps[0].label).toBe("B");
    expect(exps[1].label).toBe("A");
  });

  it("updateExperimentNotes changes notes without affecting other fields", () => {
    const exp = saveExperiment({ label: "X", params: BASE_PARAMS, metrics: BASE_METRICS });
    updateExperimentNotes(exp.id, "my note");
    const updated = getExperiments().find(e => e.id === exp.id)!;
    expect(updated.notes).toBe("my note");
    expect(updated.label).toBe("X");
  });

  it("deleteExperiment removes by id", () => {
    const exp = saveExperiment({ label: "del", params: BASE_PARAMS, metrics: BASE_METRICS });
    deleteExperiment(exp.id);
    expect(getExperiments()).toHaveLength(0);
  });

  it("clearExperiments empties storage", () => {
    saveExperiment({ label: "A", params: BASE_PARAMS, metrics: BASE_METRICS });
    clearExperiments();
    expect(getExperiments()).toHaveLength(0);
  });

  it("makeExperimentLabel: ema_cross", () => {
    expect(makeExperimentLabel({ strategy: "ema_cross", instrumentId: "AAPL.NASDAQ", fast: 10, slow: 20 }))
      .toBe("AAPL.NASDAQ EMA 10/20");
  });

  it("makeExperimentLabel: gated", () => {
    expect(makeExperimentLabel({ strategy: "gated", instrumentId: "005930.XKRX", rulesCount: 3 }))
      .toBe("005930.XKRX Gated (3 rules)");
  });

  it("extractMetrics maps BacktestResponse fields correctly", () => {
    const mockResult: BacktestResponse = {
      sharpe_ratio: 1.5,
      sortino_ratio: 2.1,
      max_drawdown: -0.12,
      volatility: 0.18,
      beta: 0.9,
      total_pnl: 5000,
      total_pnl_pct: 0.22,
      win_rate: 0.55,
      profit_loss_ratio: 1.8,
      avg_win: 120,
      avg_loss: -67,
      bar_count: 252,
      trades: [{} as any, {} as any, {} as any],
    };
    const metrics = extractMetrics(mockResult);
    expect(metrics.sharpe).toBe(1.5);
    expect(metrics.sortino).toBe(2.1);
    expect(metrics.maxDrawdown).toBe(-0.12);
    expect(metrics.winRate).toBe(0.55);
    expect(metrics.totalPnlPct).toBe(0.22);
    expect(metrics.totalTrades).toBe(3);
    expect(metrics.volatility).toBe(0.18);
  });
});
