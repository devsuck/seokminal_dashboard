import type { BacktestResponse } from "@/lib/api";

const STORAGE_KEY = "seokminal:backtest-results";
const MAX_RESULTS = 50;

export interface SavedBacktestResult {
  id: string;
  timestamp: number;
  label: string;
  instrumentId: string;
  start: string;
  end: string;
  strategy: "ema_cross" | "gated" | "macd" | "rsi";
  fast?: number;
  slow?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  result: BacktestResponse;
}

export function saveBacktestResult(
  entry: Omit<SavedBacktestResult, "id" | "timestamp">
): SavedBacktestResult | null {
  const saved: SavedBacktestResult = {
    ...entry,
    id: `bt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const existing = getBacktestResults();
  const updated = [saved, ...existing].slice(0, MAX_RESULTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    try {
      const trimmed = [saved, ...existing.slice(0, Math.floor(MAX_RESULTS / 2))];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      return null;
    }
  }
  return saved;
}

export function getBacktestResults(): SavedBacktestResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBacktestResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteBacktestResult(id: string): void {
  const updated = getBacktestResults().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearBacktestResults(): void {
  localStorage.removeItem(STORAGE_KEY);
}
