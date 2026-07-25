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

async function post<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", signal, cache: "no-store" });
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
export interface Posture {
  label: string;
  confidence: number;
  total_active: number;
  breakdown: Record<string, number>;
  basis: string;
}
export interface ConsoleRegime {
  regime: string;
  confidence: number | null;
  note?: string;
  posture?: Posture | null;
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
export interface GraphNode { id: string; label: string; type: "strategy" | "factor"; factor?: string; status?: string; count?: number }
export interface GraphEdge { source: string; target: string; kind?: string }
export interface KnowledgeResp {
  built: boolean; derived?: boolean; nodes: GraphNode[]; edges: GraphEdge[];
  factors?: Record<string, number>; statuses?: Record<string, number>;
  failed_strategies: unknown[]; note: string;
}
export interface CoverageGap { factor: string; total: number; active: number; gap: string; severity: string }
export interface ResearchResp {
  proposals: Array<Record<string, unknown>>; count?: number; note?: string;
  coverage_gaps?: CoverageGap[]; factor_coverage?: Record<string, { total: number; active: number }>;
}
export interface PostureRow { factor: string; total: number; active: number; rejected: number; conviction: number }
export interface MarketResp { regime: ConsoleRegime; posture?: PostureRow[]; note?: string }
export interface DerivedAlloc { strategy_id: string; name: string; factor: string; status: string; target_weight: number }
export interface AllocationResp { allocations: unknown[]; decisions: unknown[]; rebalances: unknown[]; note: string; derived_proposal?: DerivedAlloc[]; derived_note?: string }
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
export const getMarket = (s?: AbortSignal) => get<MarketResp>("/console/market", s);
export const getAllocation = (s?: AbortSignal) => get<AllocationResp>("/console/allocation", s);
export const getPositions = (s?: AbortSignal) => get<PositionsResp>("/console/positions", s);
export const getRisk = (s?: AbortSignal) => get<RiskResp>("/console/risk", s);
export const getOrders = (s?: AbortSignal) => get<OrdersResp>("/console/orders", s);
export const getBroker = (s?: AbortSignal) => get<BrokerResp>("/console/broker", s);
export const getMonitor = (s?: AbortSignal) => get<MonitorResp>("/console/monitor", s);

// ── /console/research-os (P41~P45 로컬 연구 환경 라이브) ──────────
export interface ResearchOSSection { section: string; moduleCount: number; items: { item: string; moduleCount: number; modules?: string[] }[] }
export interface ResearchOSGraph {
  nodes: { id: string; moduleCount: number; internal: number }[];
  edges: { source: string; target: string; weight: number }[];
  edge_total: number;
  module_edges?: { source: string; target: string; sourceSection: string; targetSection: string }[];
}
export interface ResearchOSCapability { phase: string; name: string; summary: string; metric: string }
export interface ResearchOSResp {
  meta: { section_count: number; item_count: number; module_count: number; coverage: number; duplicate_families: number; digest: string };
  sections: ResearchOSSection[];
  workspaces?: { workspace: string; description: string; moduleCount: number }[];
  graph?: ResearchOSGraph;
  audit: { module_count?: number; duplicate_cluster_count?: number; orphan_count?: number; category_distribution?: Record<string, number>; digest?: string };
  runtime: { env_status?: string; health_status?: string; module_count?: number; runtime_state?: string; checks?: { name: string; status: string; detail: string }[] };
  assistant: { total_records?: number; active_sources?: number; failure_count?: number; knowledge_count?: number; experiment_run_count?: number; potential_areas?: { area: string; rationale: string; evidence: number }[]; is_advisory?: boolean; is_decision?: boolean };
  automation: { job_count?: number; enabled_job_count?: number; run_count?: number; success_count?: number; failed_count?: number; schedule_count?: number };
  capabilities: ResearchOSCapability[];
  disclaimer: string;
}
export const getResearchOS = (s?: AbortSignal) => get<ResearchOSResp>("/console/research-os", s);

// ── /console/assistant (C3 대화형 어시스턴트) ─────────────────────
export interface AssistantResp {
  question: string; intent: string; topic?: string; answer: string;
  data?: Record<string, unknown>; suggestions?: string[];
  is_advisory?: boolean; is_decision?: boolean; disclaimer?: string;
}
export const getAssistant = (q: string, s?: AbortSignal) =>
  get<AssistantResp>(`/console/assistant?q=${encodeURIComponent(q)}`, s);

// ── /console/failure-intel (실패지능 + 다관점 + 메모리 그래프) ─────
export interface FailureIntelResp {
  failure_intelligence: { total_failures: number; by_category: Record<string, number>; top_category: string; lessons: string[] };
  memory_graph: { nodes: { id: string; type: string; label: string }[]; edges: { source: string; target: string; kind: string }[]; node_count: number; edge_count: number };
  perspectives?: { topic: string; lenses: { lens: string; stance: string; rationale: string; evidence: number }[]; conflicting: boolean; conclusion: string };
  mistake_check?: { made_this_mistake: boolean; failure_count: number; by_category: Record<string, number>; headline: string };
  is_advisory?: boolean; is_decision?: boolean;
}
export const getFailureIntel = (q = "", s?: AbortSignal) =>
  get<FailureIntelResp>(`/console/failure-intel?q=${encodeURIComponent(q)}`, s);

// ══════════════ Research OS Dashboard (P68-71) ══════════════
export interface WorkflowRun {
  run_id: string; request: string; current_stage: string; completed_stages: string[];
  blocked_stage: string; cancelled: boolean; requires_human_decision: boolean;
  execution_log: { stage: string; status: string; note: string; output_digest: string }[];
}
export interface SessionLite {
  session_id: string; goal: string; state: string; goals: string[]; progress: string[];
  pending_work: string[]; completed_experiments: string[]; lessons_learned: string[];
  open_questions: string[]; updated_at: string;
}
export interface QueueProposal {
  proposal_id: string; name: string; kind: string; reason: string; confidence: string;
  expected_value: string; basis: string[]; requires_human_approval: boolean;
}
export interface ResearchWorkflowResp {
  stages: string[]; runs: WorkflowRun[]; sessions: SessionLite[];
  queue: { proposal_count: number; by_kind: Record<string, number>; proposals: QueueProposal[] };
  counts: { runs: number; sessions: number; active_sessions: number; awaiting_human: number; proposals: number };
  is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getResearchWorkflow = (s?: AbortSignal) => get<ResearchWorkflowResp>("/console/research-workflow", s);
export const sessionAction = (action: string, sessionId = "", goal = "", s?: AbortSignal) =>
  post<SessionLite & { error?: string }>(
    `/console/session/${action}?session_id=${encodeURIComponent(sessionId)}&goal=${encodeURIComponent(goal)}`, s);

export interface DecisionMemoResp {
  question?: string; recommendation?: string; rationale?: string;
  evidence?: { digest: string; sources: string[] };
  supporting_arguments?: { lens: string; rationale: string }[];
  counter_arguments?: { lens: string; rationale: string }[];
  historical_similar_cases?: { source: string; ref: string; text: string }[];
  portfolio_impact?: Record<string, unknown>;
  risk_summary?: { main_risk?: string; label?: string; strength?: string; weakness?: string; confidence?: string; category_flags?: Record<string, string> };
  confidence?: string; confidence_breakdown?: Record<string, unknown>;
  remaining_unknowns?: string[]; suggested_next_research?: string[];
  requires_human_review?: boolean; is_decision?: boolean; note?: string;
}
export const getDecisionMemo = (q: string, s?: AbortSignal) =>
  get<DecisionMemoResp>(`/console/decision-memo?q=${encodeURIComponent(q)}`, s);

export interface EvidenceNode { stage: string; label: string; refs?: string[] }
export interface ExplainabilityResp {
  topic?: string; chain: EvidenceNode[]; edges: { from: string; to: string; kind: string }[];
  confidence?: string; confidence_breakdown?: Record<string, unknown>;
  why_this_conclusion?: string; why_it_may_be_wrong?: string[];
  alternative_interpretations?: string[]; missing_evidence?: string[];
  references_experiments?: string[]; requires_human_review?: boolean; is_decision?: boolean; note?: string;
}
export const getExplainability = (q: string, s?: AbortSignal) =>
  get<ExplainabilityResp>(`/console/explainability?q=${encodeURIComponent(q)}`, s);

export interface OperatingConsoleResp {
  date: string;
  research: { total_records?: number; active_sources?: number; experiment_runs?: number; results?: number };
  opportunities: { name: string; kind: string; confidence: string; expected_value: string; reason: string }[];
  risks: { total_failures?: number; top_category?: string; by_category?: Record<string, number>; lessons?: string[] };
  events: { node_count?: number; edge_count?: number; note?: string };
  paper: { portfolio_value?: number; n_positions?: number; pnl_summary?: Record<string, unknown> };
  exposure: { capital?: number; gross_exposure?: number; exposure_pct?: number; n_positions?: number };
  sessions: { count: number; active: number; items: SessionLite[] };
  recommendations: { topic: string; recommendation: string; conflicts: number }[];
  is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getOperatingConsole = (s?: AbortSignal) => get<OperatingConsoleResp>("/console/operating-console", s);
