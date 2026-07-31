import type { BacktestResponse } from "@/lib/api";

const STORAGE_KEY = "seokminal:experiments";
const MAX_EXPERIMENTS = 200;

export type ExperimentStrategy = "ema_cross" | "gated" | "macd" | "rsi" | "xgb";

export interface ExperimentParams {
  strategy: ExperimentStrategy;
  instrumentId: string;
  start: string;
  end: string;
  timeframe: string;
  benchmarkId: string;
  fast?: number;
  slow?: number;
  rulesCount?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  xgbTrainRatio?: number;
  xgbNEstimators?: number;
  xgbMaxDepth?: number;
  xgbLearningRate?: number;
}

export interface ExperimentMetrics {
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  totalPnlPct: number | null;
  totalTrades: number;
  volatility: number | null;
}

export interface Experiment {
  id: string;
  timestamp: number;
  label: string;
  notes: string;
  params: ExperimentParams;
  metrics: ExperimentMetrics;
}

export function makeExperimentLabel(
  params: Pick<ExperimentParams, "strategy" | "instrumentId" | "fast" | "slow" | "rulesCount" | "macdFast" | "macdSlow" | "macdSignal" | "rsiPeriod" | "xgbTrainRatio" | "xgbNEstimators" | "xgbMaxDepth">
): string {
  if (params.strategy === "ema_cross") {
    return `${params.instrumentId} EMA ${params.fast ?? "?"}/${params.slow ?? "?"}`;
  }
  if (params.strategy === "macd") {
    return `${params.instrumentId} MACD ${params.macdFast ?? "?"}/${params.macdSlow ?? "?"}/${params.macdSignal ?? "?"}`;
  }
  if (params.strategy === "rsi") {
    return `${params.instrumentId} RSI(${params.rsiPeriod ?? "?"})`;
  }
  if (params.strategy === "xgb") {
    return `${params.instrumentId} XGBoost ${params.xgbTrainRatio ?? "?"}/${params.xgbNEstimators ?? "?"}/${params.xgbMaxDepth ?? "?"}`;
  }
  return `${params.instrumentId} Gated (${params.rulesCount ?? 0} rules)`;
}

export function extractMetrics(result: BacktestResponse): ExperimentMetrics {
  return {
    sharpe: result.sharpe_ratio,
    sortino: result.sortino_ratio,
    maxDrawdown: result.max_drawdown,
    winRate: result.win_rate,
    totalPnlPct: result.total_pnl_pct,
    totalTrades: result.trades.length,
    volatility: result.volatility,
  };
}

export function saveExperiment(
  entry: Omit<Experiment, "id" | "timestamp" | "notes">
): Experiment {
  const experiment: Experiment = {
    ...entry,
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    notes: "",
  };
  const existing = getSavedRuns();
  const updated = [experiment, ...existing].slice(0, MAX_EXPERIMENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Quota exceeded — trim to half and retry
    try {
      const trimmed = [experiment, ...existing.slice(0, Math.floor(MAX_EXPERIMENTS / 2))];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Storage exhausted — silently skip persistence
    }
  }
  return experiment;
}

export function getSavedRuns(): Experiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Experiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updateExperimentNotes(id: string, notes: string): void {
  const updated = getSavedRuns().map(e => e.id === id ? { ...e, notes } : e);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteExperiment(id: string): void {
  const updated = getSavedRuns().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearExperiments(): void {
  localStorage.removeItem(STORAGE_KEY);
}
