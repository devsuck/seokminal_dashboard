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

// ── 확장 엔드포인트 (Strategy DNA · Validation · Council · Knowledge · Portfolio · Execution) ──
export interface StrategyRow {
  strategy_id: string; name: string; status: string; factor: string;
  frozen: boolean; config_hash: string; created_at: string; updated_at: string;
}
export interface StrategiesResp {
  strategies: StrategyRow[]; total: number;
  by_status: Record<string, number>; by_factor: Record<string, number>;
}
export interface StrategyDetail {
  strategy_id: string; state: Record<string, unknown> | null; factor: string;
  lifecycle: Array<Record<string, unknown>>; experiments: Array<Record<string, unknown>>;
  experiment_count: number;
}
export interface ExperimentsResp {
  latest: Array<Record<string, unknown>>; counts: Record<string, number>;
  total_experiments: number; unique_hypotheses: number; recent: Array<Record<string, unknown>>;
}
export interface ValidationResp {
  redteam: { n: number; human_redteam_agree?: number; rows: Array<Record<string, unknown>> };
  experiment_status: Record<string, number>; gates: string[];
}
export interface AgentNode {
  id: string; name: string; role?: string; status: string; detail?: string;
  meta?: Record<string, number>; children?: AgentNode[];
}
export interface AgentsResp { council: AgentNode; archetypes: string[]; live_execution_enabled: boolean }
export interface LogsResp { logs: Array<Record<string, unknown>>; count: number }
export interface KnowledgeResp { built: boolean; nodes: unknown[]; edges: unknown[]; failed_strategies: unknown[]; note: string }
export interface ResearchResp { proposals: Array<Record<string, unknown>>; count?: number; note?: string }
export interface AllocationResp { allocations: unknown[]; decisions: unknown[]; rebalances: unknown[]; note: string }
export interface PositionsResp { positions: Array<Record<string, unknown>>; count: number; note: string }
export interface RiskResp {
  governor: string; limits: Record<string, unknown>; capital: ConsoleStatus["capital"];
  autonomy: { level: number; min_live: number; live_execution_enabled: boolean };
  execution_risk_events: number; by_status: Record<string, number>;
}
export interface OrdersResp { requests: unknown[]; responses: unknown[]; lifecycle_events: number; note: string }
export interface BrokerResp { read_only: Record<string, Record<string, unknown>>; execution_adapters: Record<string, Record<string, unknown>> }
export interface MonitorResp extends ConsolePipeline { capital: ConsoleStatus["capital"] }

export const getStrategies = (s?: AbortSignal) => get<StrategiesResp>("/console/strategies", s);
export const getStrategyDetail = (id: string, s?: AbortSignal) => get<StrategyDetail>(`/console/strategies/${encodeURIComponent(id)}`, s);
export const getExperiments = (limit = 60, s?: AbortSignal) => get<ExperimentsResp>(`/console/experiments?limit=${limit}`, s);
export const getValidation = (s?: AbortSignal) => get<ValidationResp>("/console/validation", s);
export const getAgents = (s?: AbortSignal) => get<AgentsResp>("/console/agents", s);
export const getLogs = (limit = 60, s?: AbortSignal) => get<LogsResp>(`/console/logs?limit=${limit}`, s);
export const getKnowledge = (s?: AbortSignal) => get<KnowledgeResp>("/console/knowledge", s);
export const getResearch = (s?: AbortSignal) => get<ResearchResp>("/console/research", s);
export const getMarket = (s?: AbortSignal) => get<ConsoleRegime & { regime: ConsoleRegime }>("/console/market", s);
export const getAllocation = (s?: AbortSignal) => get<AllocationResp>("/console/allocation", s);
export const getPositions = (s?: AbortSignal) => get<PositionsResp>("/console/positions", s);
export const getRisk = (s?: AbortSignal) => get<RiskResp>("/console/risk", s);
export const getOrders = (s?: AbortSignal) => get<OrdersResp>("/console/orders", s);
export const getBroker = (s?: AbortSignal) => get<BrokerResp>("/console/broker", s);
export const getMonitor = (s?: AbortSignal) => get<MonitorResp>("/console/monitor", s);
