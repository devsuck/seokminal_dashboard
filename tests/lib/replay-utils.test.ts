import { describe, it, expect } from "vitest";
import { computeRunningStats } from "../../lib/replay-utils";
import type { TradeRecord } from "../../lib/api";

function makeTrade(pnl: number | null, side = "LONG"): TradeRecord {
  return {
    entry_ts_ns: 1_000_000_000_000,
    exit_ts_ns: pnl !== null ? 2_000_000_000_000 : null,
    entry_price: 100,
    exit_price: pnl !== null ? 110 : null,
    side,
    pnl,
    qty: 1,
  };
}

describe("computeRunningStats", () => {
  it("returns zeros for upToIndex < 0", () => {
    const trades = [makeTrade(50)];
    const stats = computeRunningStats(trades, -1);
    expect(stats.totalTrades).toBe(0);
    expect(stats.completedTrades).toBe(0);
    expect(stats.runningPnl).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.bestTrade).toBeNull();
  });

  it("handles empty trades array", () => {
    const stats = computeRunningStats([], 0);
    expect(stats.totalTrades).toBe(0);
    expect(stats.completedTrades).toBe(0);
    expect(stats.runningPnl).toBe(0);
    expect(stats.winRate).toBeNull();
  });

  it("counts only completed trades (with exit_price)", () => {
    const trades = [makeTrade(50), makeTrade(null), makeTrade(30)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.totalTrades).toBe(3);
    expect(stats.completedTrades).toBe(2);
  });

  it("accumulates running PnL from completed trades only", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(null)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.runningPnl).toBeCloseTo(30);
  });

  it("computes win rate correctly", () => {
    const trades = [makeTrade(50), makeTrade(30), makeTrade(-20)];
    const stats = computeRunningStats(trades, 2);
    // 2 wins out of 3 completed
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
    expect(stats.winCount).toBe(2);
    expect(stats.lossCount).toBe(1);
  });

  it("respects upToIndex — only includes trades up to that index", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(100)];
    const stats = computeRunningStats(trades, 0);
    expect(stats.totalTrades).toBe(1);
    expect(stats.runningPnl).toBeCloseTo(50);
  });

  it("computes best and worst trade", () => {
    const trades = [makeTrade(50), makeTrade(-20), makeTrade(100)];
    const stats = computeRunningStats(trades, 2);
    expect(stats.bestTrade).toBeCloseTo(100);
    expect(stats.worstTrade).toBeCloseTo(-20);
  });
});
