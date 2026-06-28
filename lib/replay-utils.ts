import type { TradeRecord } from "@/lib/api";

export interface RunningStats {
  totalTrades: number;
  completedTrades: number;
  runningPnl: number;
  winCount: number;
  lossCount: number;
  winRate: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
}

export function computeRunningStats(
  trades: TradeRecord[],
  upToIndex: number,
): RunningStats {
  if (upToIndex < 0 || trades.length === 0) {
    return {
      totalTrades: 0,
      completedTrades: 0,
      runningPnl: 0,
      winCount: 0,
      lossCount: 0,
      winRate: null,
      bestTrade: null,
      worstTrade: null,
    };
  }
  const slice = trades.slice(0, upToIndex + 1);
  const completed = slice.filter(
    (t): t is TradeRecord & { pnl: number; exit_price: number } =>
      t.exit_price !== null && t.pnl !== null,
  );
  const pnls = completed.map(t => t.pnl);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p <= 0);
  const runningPnl = pnls.reduce((s, p) => s + p, 0);
  return {
    totalTrades: slice.length,
    completedTrades: completed.length,
    runningPnl,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: completed.length > 0 ? wins.length / completed.length : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
  };
}
