// AI Hedge Fund Operations Console — typed client for the read-only /console/* API.
// 실데이터 전용. 백엔드(api_server/console_api.py)의 거버넌스/집행 파이프라인 표면에 연결.

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" ? `http://${window.location.hostname}:8000` : "http://127.0.0.1:8000");

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── /console/status ───────────────────────────────────────────────
export interface ConsoleStatus {
  system: string;
  initialized: boolean;
  autonomy: { level: number; min_live: number; name: string; live_execution_enabled: boolean };
  boundaries: {
    live_execution: string;
    paper_monitoring: string;
    research_automation: string;
    risk_governor: string;
    audit_log: string;
  };
  strategies: { total: number; active: number; by_status: Record<string, number> };
  capital: { capital: number | null; gross_exposure: number; exposure_pct: number; n_positions: number };
}

// ── /console/pipeline ─────────────────────────────────────────────
export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  by_status: Record<string, number>;
}
export interface ConsolePipeline {
  stages: PipelineStage[];
  proposals: number;
  approvals: number;
  note: string;
}

// ── /console/regime ───────────────────────────────────────────────
export interface ConsoleRegime {
  regime: string;
  confidence: number | null;
  note?: string;
  [k: string]: unknown;
}

// ── /console/council ──────────────────────────────────────────────
export interface ConsoleCouncil {
  source: string;
  decisions: Array<Record<string, unknown>>;
  count: number;
}

export const getConsoleStatus = (s?: AbortSignal) => get<ConsoleStatus>("/console/status", s);
export const getConsolePipeline = (s?: AbortSignal) => get<ConsolePipeline>("/console/pipeline", s);
export const getConsoleRegime = (s?: AbortSignal) => get<ConsoleRegime>("/console/regime", s);
export const getConsoleCouncil = (limit = 20, s?: AbortSignal) =>
  get<ConsoleCouncil>(`/console/council?limit=${limit}`, s);
