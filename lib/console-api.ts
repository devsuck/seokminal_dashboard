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

// ── 확장 엔드포인트 (Validation · Council · Knowledge · Portfolio · Execution) ──
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
export interface DerivedAlloc { strategy_id: string; name: string; factor: string; status: string; target_weight: number }
export interface AllocationResp { allocations: unknown[]; decisions: unknown[]; rebalances: unknown[]; note: string; derived_proposal?: DerivedAlloc[]; derived_note?: string }
export interface FusionContribution { strategy_id: string; direction: number; strength: number; weight: number; signed_contribution: number; perf_score: number; underpowered: boolean; reason: string }
export interface FusionSignalRow { instrument: string; direction: number; confidence: number; score: number; scheme: string; as_of: string; n_strategies: number; contributions: FusionContribution[] }
export interface FusionResp { fusion_signals: FusionSignalRow[]; note: string }
export interface OverlayRow {
  strategy_id: string; instrument: string; strategy_target_weight: number; intra_strategy_weight: number;
  direction: number; instrument_target_weight: number; fusion_direction: number | null;
  fusion_confidence: number | null; conflict: boolean;
}
export interface OverlayResp { strategy_weights: Record<string, number>; overlay: OverlayRow[]; note: string; warn: string }
export interface PositionsResp { positions: Array<Record<string, unknown>>; count: number; note: string }
export interface RiskResp {
  governor: string; limits: Record<string, unknown>; capital: ConsoleStatus["capital"];
  autonomy: { level: number; min_live: number; live_execution_enabled: boolean };
  execution_risk_events: number; by_status: Record<string, number>;
}
export interface OrdersResp { requests: unknown[]; responses: unknown[]; lifecycle_events: number; note: string }
export interface MonitorResp extends ConsolePipeline { capital: ConsoleStatus["capital"] }

export const getValidation = (s?: AbortSignal) => get<ValidationResp>("/console/validation", s);
export const getAgents = (s?: AbortSignal) => get<AgentsResp>("/console/agents", s);
export const getLogs = (limit = 60, s?: AbortSignal) => get<LogsResp>(`/console/logs?limit=${limit}`, s);
export const getAllocation = (s?: AbortSignal) => get<AllocationResp>("/console/allocation", s);
export const getFusion = (s?: AbortSignal) => get<FusionResp>("/console/fusion", s);
export const getOverlay = (s?: AbortSignal) => get<OverlayResp>("/console/overlay", s);
export const getPositions = (s?: AbortSignal) => get<PositionsResp>("/console/positions", s);
export const getRisk = (s?: AbortSignal) => get<RiskResp>("/console/risk", s);
export const getOrders = (s?: AbortSignal) => get<OrdersResp>("/console/orders", s);
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

// ══════════════ Research OS Completion (P77-85) ══════════════
export interface AutonomousRuntimeResp {
  topic: string; loop_stages: string[];
  preview: { hypotheses?: { hypothesis_id: string; statement: string; rationale: string; expected_edge: string; assumptions: string[]; invalidation_conditions: string[]; source: string; confidence: string }[];
    ranked?: { items: { hypothesis_id: string; statement: string; score: number; rank: number; source: string }[]; recommended: Record<string, unknown> };
    recommended_spec?: Record<string, unknown>;
    critique?: { subject: string; verdict: string; blocks: boolean; blocking_dimensions: string[]; critiques: { dimension: string; severity: string; finding: string; evidence: string }[] } };
  loops: { loop_id: string; idea: string; current_stage: string; completed_stages: string[]; blocked_stage: string; cancelled: boolean; paused: boolean; requires_human_checkpoint: boolean; audit_trail: { stage: string; status: string; note: string }[] }[];
  counts: { loops: number; awaiting_checkpoint: number };
  is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getAutonomousRuntime = (q = "", s?: AbortSignal) =>
  get<AutonomousRuntimeResp>(`/console/autonomous-runtime?q=${encodeURIComponent(q)}`, s);

export interface TimelineEntry { timestamp: string; stage: string; source: string; ref: string; label: string }
export interface TimelineResp { topic: string; entries: TimelineEntry[]; count: number; by_stage: Record<string, number>; stage_order: string[]; note: string }
export const getResearchTimeline = (q = "", s?: AbortSignal) =>
  get<TimelineResp>(`/console/research-timeline?q=${encodeURIComponent(q)}`, s);

export interface KGraphNode { id: string; type: string; label: string }
export interface KGraphEdge { source: string; target: string; kind: string }
export interface ResearchGraphResp {
  topic: string; nodes: KGraphNode[]; edges: KGraphEdge[]; node_count: number; edge_count: number;
  node_types: Record<string, number>; edge_kinds: Record<string, number>; relationship_kinds: string[]; note: string;
}
export const getResearchGraph = (q = "", s?: AbortSignal) =>
  get<ResearchGraphResp>(`/console/research-graph?q=${encodeURIComponent(q)}`, s);

export interface HealthResp {
  active_research: number; waiting_human_review: number; validation_missing: number;
  incomplete_research: number; knowledge_growth: number; failure_distribution: Record<string, number>;
  total_failures: number; research_velocity: number;
  coverage: { validation: number; portfolio: number; risk: number; memory: number };
  score_components: Record<string, number>; overall_health_score: number; health_band: string; trend: string;
}
export const getResearchHealth = (s?: AbortSignal) => get<HealthResp>("/console/research-health", s);

export interface CockpitResp {
  research: { total_records?: number; experiment_runs?: number; active_sources?: number };
  current_loop: { loop_id?: string; idea?: string; current_stage?: string; completed?: string[]; blocked_stage?: string; requires_human_checkpoint?: boolean };
  top_opportunities: { name: string; kind: string; confidence: string; expected_value: string }[];
  highest_risks: { total_failures?: number; top_category?: string; by_category?: Record<string, number> };
  portfolio_exposure: { capital?: number; gross_exposure?: number; n_positions?: number };
  research_health: HealthResp;
  knowledge_growth: { total: number; channels: Record<string, number>; graph_nodes: number; graph_edges: number };
  timeline: TimelineEntry[];
  knowledge_graph: { node_count: number; edge_count: number; node_types: Record<string, number> };
  research_queue: { name: string; kind: string; confidence: string; expected_value: string }[];
  human_review_queue: { run_id: string; request: string }[];
  recent_sessions: SessionLite[];
  quick_resume: { session_id: string; goal: string; state: string }[];
  health_score: number; is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getCockpit = (s?: AbortSignal) => get<CockpitResp>("/console/cockpit", s);

// ══════════════ Market Intelligence & Investment Research OS (P86-95) ══════════════
export interface MarketRegimeResp {
  regime: string; labels?: string[]; confidence?: number;
  historical_similar_periods?: { period: string; overlap: string[] }[];
  favorable_strategies?: string[]; unfavorable_strategies?: string[];
  recommended_research?: string[]; avoid?: string[]; note?: string; is_decision?: boolean;
}
export const getMarketRegime = (s?: AbortSignal) => get<MarketRegimeResp>("/console/market-regime", s);

export interface OpportunityResp {
  opportunities: { type: string; title: string; reason: string; evidence: string[];
    suggested_hypothesis: string; confidence: string; is_trade_signal: boolean }[];
  count: number; by_type?: Record<string, number>; note?: string;
}
export const getOpportunityQueue = (s?: AbortSignal) => get<OpportunityResp>("/console/opportunity-queue", s);

export interface AltDataResp {
  sources: Record<string, { maps_to: string; signal: string }>; count: number; flow: string[]; note: string;
}
export const getAltData = (s?: AbortSignal) => get<AltDataResp>("/console/alt-data", s);

export interface CouncilExpandedResp {
  question?: string; expanded_perspectives: string[]; recommendation?: string;
  lenses?: { lens: string; stance: string; rationale: string }[];
  conflicts?: { support: string; caution: string }[]; note?: string; is_decision?: boolean;
}
export const getCouncilExpanded = (q: string, s?: AbortSignal) =>
  get<CouncilExpandedResp>(`/console/council-expanded?q=${encodeURIComponent(q)}`, s);

export interface StrategyLabResp {
  strategy?: string; type?: string;
  dna?: { factors: string[]; universe: string; time_horizon: string; entry_logic: string;
    exit_logic: string; risk_model: Record<string, unknown>; validation_method: unknown;
    failure_history: { count?: number; by_category?: Record<string, number> }; successful_regimes: string[] };
  repeated_mistakes?: { made_this_mistake: boolean; failure_count: number; headline: string };
  note?: string;
}
export const getStrategyLab = (q: string, s?: AbortSignal) =>
  get<StrategyLabResp>(`/console/strategy-lab?q=${encodeURIComponent(q)}`, s);

export interface MarketCockpitResp {
  market_state: { regime: string; confidence?: number; labels: string[]; recommended_research: string[];
    avoid: string[]; historical_similar_periods: { period: string; overlap: string[] }[] };
  research_opportunities: OpportunityResp["opportunities"];
  active_experiments: Record<string, unknown>;
  validation_status: { health?: number; coverage?: Record<string, number>; incomplete?: number };
  risk: { total_failures?: number; top_category?: string; by_category?: Record<string, number> };
  portfolio_context: { capital?: number; gross_exposure?: number; n_positions?: number };
  decision_queue: { run_id: string; request: string }[];
  knowledge_growth: { total: number; graph_nodes: number; graph_edges: number };
  timeline: TimelineEntry[]; top_opportunities: { name: string; kind: string; confidence: string; expected_value: string }[];
  health_score: number; is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getMarketCockpit = (s?: AbortSignal) => get<MarketCockpitResp>("/console/market-cockpit", s);

// ══════════════ Live Market Intelligence Integration (P96-100) ══════════════
export interface MarketIntelFeedResp {
  query: string;
  live_event_feed: { category: string; event_type: string; label: string; affected: string[]; relevance: string }[];
  impact_map: { origin?: string; affected_entities?: { entity: string; category: string; distance: number; relationship_path: string[]; uncertainty: string }[]; customers?: string[]; direct_suppliers?: string[] };
  research_opportunities: { type: string; title: string; confidence: string; suggested_hypothesis: string }[];
  market_context: { regime: string; labels: string[]; recommended_research: string[]; avoid: string[] };
  adapters: string[]; is_advisory: boolean; is_decision: boolean; disclaimer: string;
}
export const getMarketIntelFeed = (q = "", entity = "", s?: AbortSignal) =>
  get<MarketIntelFeedResp>(`/console/market-intel-feed?q=${encodeURIComponent(q)}&entity=${encodeURIComponent(entity)}`, s);

// ── /console/validation-loop (P101-110 Research Validation Loop) ──────────────
export interface LifecycleStep { state: string; done: boolean; current: boolean }
export interface LifecycleRow { strategy: string; current_state: string; checklist: LifecycleStep[] }
export interface GapDetail { [k: string]: unknown }
export interface ValidationLoopResp {
  lifecycle_board: {
    lifecycle: string[];
    strategies: LifecycleRow[];
    count: number;
    by_state: Record<string, number>;
  };
  validation_panel: {
    backtest: Record<string, number>;
    paper: Record<string, number>;
    tracked_metrics: Record<string, { expected: number | null; actual: number | null; gap: number | null }>;
    status: string;
    divergence_detected: boolean;
    cause: string;
    gaps: Record<string, GapDetail>;
    possible_causes: { cause: string; why: string }[];
    is_demo: boolean;
  };
  quality_panel: {
    quality_score: number | null;
    grade: string;
    core_dimensions: Record<string, number>;
    weaknesses: string[];
    missing_validations: string[];
    gate: string;
    is_demo: boolean;
  };
  review_queue: { timestamp: string; event_type: string; source: string; ref: string; label: string }[];
  ops_events: { timestamp: string; event_type: string; source: string; ref: string; label: string; requires_human_review: boolean }[];
  ops_by_type: Record<string, number>;
  loop_status: { loop_complete: boolean; release_ready: boolean; safe: boolean; capabilities: string[] };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getValidationLoop = (strategy = "", s?: AbortSignal) =>
  get<ValidationLoopResp>(`/console/validation-loop?strategy=${encodeURIComponent(strategy)}`, s);

// ── /console/live-intelligence (P111-120 Live Data Infrastructure) ────────────
export interface ProviderRow {
  name: string; category: string; vendor: string; module: string; env_key: string;
  available_data: string; consumer: string; available: boolean; status: string;
}
export interface LiveIntelligenceResp {
  data_sources: {
    providers: ProviderRow[];
    count: number;
    available_count: number;
    by_category: Record<string, number>;
  };
  market_feed: { category: string; label: string; event_type: string; affected: string[] }[];
  research_queue: { type: string; title: string; confidence: string; suggested_hypothesis: string }[];
  research_queue_count: number;
  dropped_duplicates: number;
  data_health: {
    overall_status: string;
    api_availability: { available: number; total: number; ratio: number; unavailable: string[] };
    issue_count: number;
    checks: string[];
  };
  is_demo: boolean;
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getLiveIntelligence = (s?: AbortSignal) =>
  get<LiveIntelligenceResp>(`/console/live-intelligence`, s);

// ── /console/agent-workspace (P121-130 Research Agent OS) ─────────────────────
export interface AgentRow {
  agent: string; role: string; level: string; purpose: string;
  input: string; output: string; used_engines: string[];
}
export interface AgentWorkspaceResp {
  agents: AgentRow[];
  role_hierarchy: string[];
  active_research: {
    objective: string;
    pipeline: string[];
    director_plan: {
      hypothesis?: string;
      required_data?: string[];
      assigned_agents?: { agent: string; task: string }[];
      validation_plan?: string[];
    };
  };
  agent_status: { agent: string; role: string; ok: boolean }[];
  current_tasks: { agent: string; task: string }[];
  generated_reports: { objective: string; confidence: string; sections: string[]; limitations: string[] }[];
  critic_feedback: {
    verdict: string;
    blocks: boolean;
    dimensions: Record<string, unknown>;
    quality: { grade?: string; score?: number; weaknesses?: string[]; missing_validations?: string[] };
  };
  human_review_queue: { objective: string; verdict: string; confidence: string }[];
  specialist_memos: Record<string, string>;
  is_demo: boolean;
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getAgentWorkspace = (objective = "", company = "", s?: AbortSignal) =>
  get<AgentWorkspaceResp>(`/console/agent-workspace?objective=${encodeURIComponent(objective)}&company=${encodeURIComponent(company)}`, s);

// ── /console/research-brain (P131-140 Research Knowledge Intelligence) ────────
export interface BrainNode { id: string; type: string; label: string }
export interface BrainEdge { source: string; target: string; kind: string }
export interface ResearchBrainResp {
  knowledge_graph: {
    nodes: BrainNode[];
    edges: BrainEdge[];
    node_count: number;
    node_types: Record<string, number>;
    research_chain: string[];
  };
  past_research: BrainNode[];
  failure_patterns: { total_failures: number; by_category: Record<string, number>; top_category: string | null; lessons: string[] };
  strategy_memory: BrainNode[];
  company_memory: BrainNode[];
  conflicts: {
    topic: string;
    study_a: { conclusion: string; summary: string };
    study_b: { conclusion: string; summary: string };
    period: string;
    possible_explanation: string;
  }[];
  lessons: BrainNode[];
  knowledge_health: { health_score: number | null; grade: string; issues: Record<string, number> };
  entity_counts: Record<string, number>;
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getResearchBrain = (topic = "", s?: AbortSignal) =>
  get<ResearchBrainResp>(`/console/research-brain?topic=${encodeURIComponent(topic)}`, s);

// ── /console/research-organization (P141-150 Institutional Research) ──────────
export interface ResearchOrganizationResp {
  market_overview: {
    regime: { regime?: string; labels?: string[]; recommended_research?: string[] };
    opportunities: { title: string; confidence: string }[];
    risk_factors: string[];
    confidence: string;
  };
  company_monitoring: {
    company: string;
    events: { kind: string; label: string; detail: string }[];
    impact: { direction?: string; positive_surprises?: number; negative_surprises?: number };
    research_priority: string;
  };
  strategy_health: {
    strategies: { strategy: string; health_score: number; grade: string; warnings: number; review_needed: boolean }[];
    review_needed_count: number;
  };
  agent_status: {
    agents: Record<string, { metric: string; score: number }>;
    overall_effectiveness: number | null;
  };
  knowledge_health: { health_score: number | null; grade: string; issues: Record<string, number> };
  research_reports: { agent: string; role: string; output: string }[];
  review_queue: { event_type: string; label: string; source: string }[];
  operational_status: { operational: boolean; version: string; capabilities: string[] };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getResearchOrganization = (topic = "", s?: AbortSignal) =>
  get<ResearchOrganizationResp>(`/console/research-organization?topic=${encodeURIComponent(topic)}`, s);

// ── /console/institutional-intelligence (P151-160) ───────────────────────────
export interface InstitutionalIntelligenceResp {
  data_production_health: {
    overall_status: string;
    available_count: number;
    count: number;
    average_quality: number;
    reports: { provider: string; category: string; availability: string; freshness: string; quality_score: number }[];
  };
  market_intelligence: { regime: string; labels: string[] };
  sector_intelligence: { sector: string; key_entities: string[]; risk_factors: string[]; research_questions: string[] };
  macro_context: {
    macro_state: string;
    indicators: Record<string, { value: number | null; state: string }>;
    affected_assets: { asset_class: string; sensitivity: string; direction: string }[];
    uncertainty: string;
  };
  company_intelligence: {
    entity: string;
    relationships: { suppliers?: string[]; customers?: string[]; competitors?: string[]; related_sectors?: string[] };
    risks: string[];
  };
  knowledge_context: { health_score: number | null; grade: string };
  quality_scores: { confidence: string; dimensions: Record<string, number>; reliability: number | null };
  validation: { validated: boolean; capabilities: string[] };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getInstitutionalIntelligence = (topic = "", sector = "semiconductor", entity = "TSMC", s?: AbortSignal) =>
  get<InstitutionalIntelligenceResp>(`/console/institutional-intelligence?topic=${encodeURIComponent(topic)}&sector=${encodeURIComponent(sector)}&entity=${encodeURIComponent(entity)}`, s);

// ── /console/production-readiness (P161-170 Committee & Production) ───────────
export interface ProductionReadinessResp {
  institutional_overview: { version: string; release_ready: boolean; architecture_frozen: boolean; capabilities: string[] };
  committee_packet: {
    research_summary: string;
    confidence: string;
    limitations: string[];
    questions_for_human: string[];
    risk_summary: Record<string, unknown>;
    alternative_views: Record<string, unknown>;
  };
  debate: {
    bull_case: { claim?: string; evidence?: unknown[] };
    bear_case: { claim?: string; evidence?: unknown[] };
    risk_case: { main_risk?: string; label?: string };
    historical_counterexamples: { topic: string; study_a: string; study_b: string; explanation: string }[];
  };
  conviction: { level: string; score: number | null; factors: Record<string, number> };
  portfolio_research: {
    strategy_health: { strategy: string; health_score: number; review_needed: boolean }[];
    factor_exposure: Record<string, number>;
    concentration: { n_strategies?: number; concentration?: string; review_needed?: number };
    correlation: { pair: string; value: number; label: string }[];
  };
  governance_status: { governance: string; passed: boolean; checks: { check: string; ok: boolean; detail: string }[] };
  production_health: {
    overall_severity: string;
    components: { component: string; severity: string; detail: string }[];
    counts: Record<string, number>;
  };
  operational_metrics: Record<string, unknown>;
  review_queue: { task: string; source: string }[];
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getProductionReadiness = (q = "", s?: AbortSignal) =>
  get<ProductionReadinessResp>(`/console/production-readiness?q=${encodeURIComponent(q)}`, s);

// P171-180 Autonomous Research Intelligence Enhancement (READ ONLY)
export interface CreativeHypothesis {
  hypothesis_id: string;
  statement: string;
  source: string;
  novelty_score: number;
  uncertainty: number;
  confidence: string;
  expected_edge?: string;
  evidence_chain: string[];
  similar_historical_research: {
    prior_research_count: number;
    past_conclusions: number;
    similar_failures: number;
    tried_before: boolean;
  };
  conflicting_evidence: { count: number; contradictions: number; examples: unknown[] };
  required_validation: string[];
}
export interface ResearchIntelligenceResp {
  query: string;
  creative_hypotheses: {
    count: number;
    diversity: { sources?: string[]; novelty_range?: number[] };
    hypotheses: CreativeHypothesis[];
  };
  research_search: {
    surfaced_count: number;
    merged_duplicates: number;
    candidates: { statement: string; dimension: string; value: string; score: number }[];
  };
  continuous_queue: {
    queue_size: number;
    by_source: Record<string, number>;
    backlog: { statement: string; score: number; source: string; rank: number }[];
    recommended_next: { statement?: string; score?: number };
  };
  experiment_prioritization: {
    coverage_context: {
      knowledge_nodes?: number;
      knowledge_edges?: number;
      research_coverage?: number;
      knowledge_gap?: number;
    };
    recommendations: {
      statement: string;
      source: string;
      composite_score: number;
      factors: Record<string, number>;
    }[];
  };
  research_planning: Record<
    string,
    { cadence?: string; agenda?: { item: string; source: string }[]; roadmap?: { theme: string; quarter_slot: number }[] }
  >;
  productivity: {
    metrics: Record<string, { value: unknown; detail?: string; grade?: string; unit?: string }>;
    recommendations: { area: string; priority: string; recommendation: string }[];
  };
  self_reflection: Record<string, string[]>;
  autonomy_validation: {
    validated: boolean;
    checks: { check: string; ok: boolean; detail?: string }[];
    reuse_count: number;
    duplicated_logic: string[];
    remaining_limitations: string[];
  };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getResearchIntelligence = (q = "", s?: AbortSignal) =>
  get<ResearchIntelligenceResp>(`/console/research-intelligence?q=${encodeURIComponent(q)}`, s);

// P181-200 Autonomous Research Discovery & Validation Loop v3.0 (READ ONLY)
export interface AutonomousResearchResp {
  query: string;
  cycle_status: {
    state: string;
    history: string[];
    human_checkpoint_pending: boolean;
    auto_backtest: boolean;
  };
  opportunities: {
    count: number;
    by_type: Record<string, number>;
    items: {
      opportunity_id: string;
      type: string;
      observation: string;
      possible_questions: string[];
      confidence: number;
      is_signal: boolean;
    }[];
  };
  hypotheses: {
    count: number;
    with_why_different: number;
    items: {
      hypothesis_id: string;
      question: string;
      why_now: string;
      novelty: number;
      past_failures: number;
      confidence: number;
      why_different_this_time?: string;
    }[];
  };
  experiment_queue: {
    queue_size: number;
    requests: { request_id: string; question: string; priority_score: number; why_important: string }[];
    available_actions: string[];
    forbidden_actions: string[];
  };
  research_ranking: {
    queue: { rank: number; question: string; priority_score: number; why_important: string }[];
    formula: string;
  };
  validation_results: { by_outcome?: Record<string, number> };
  human_review_queue: { pending: number; actions: string[] };
  metrics: Record<string, unknown>;
  loop_validation: { validated: boolean; checks: { stage: string; ok: boolean }[] };
  production_audit: { audited: boolean; ledger_count: number; duplicate_logic: string[] };
  release: {
    version: string;
    status: string;
    research_automation: string;
    execution: string;
    decision_authority: string;
    production_ready: boolean;
    capabilities: { can?: string[]; cannot?: string[] };
  };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getAutonomousResearch = (q = "", s?: AbortSignal) =>
  get<AutonomousResearchResp>(`/console/autonomous-research?q=${encodeURIComponent(q)}`, s);

// Investment OS — Research OS 와 완전 분리된 계층 (READ ONLY, 추천/시뮬레이션)
export interface InvestmentOsResp {
  knowledge: { consumed_candidates: number; research_os_modified: boolean; edge_score_status: string };
  portfolio: { weights: Record<string, number>; method: string };
  exposure: { max_weight?: number; n_positions?: number; herfindahl?: number };
  risk_budget: { within_budget?: boolean; breaches?: string[]; summary?: string; max_risk_contrib_cap?: number };
  scenarios: { scenario?: string; portfolio_impact_pct?: number; estimated_pnl?: number };
  compliance: { compliant?: boolean; human_can_override?: boolean };
  gates: { passed?: boolean; bypass_possible?: boolean };
  position_sizing: Record<string, number>;
  capital_allocation_executes: boolean;
  execution_ladder: { rungs: string[]; auto_execution_enabled: boolean; human_approval_mandatory: boolean };
  separation: { separated?: boolean; invariants?: { check: string; ok: boolean }[] };
  is_advisory: boolean;
  is_decision: boolean;
  disclaimer: string;
}
export const getInvestmentOs = (notional = 1_000_000, s?: AbortSignal) =>
  get<InvestmentOsResp>(`/console/investment-os?notional=${notional}`, s);

export interface LadderAdvanceResp {
  requested_from: string;
  approved: boolean;
  advanced: boolean;
  new_rung: string;
  blocked_reason: string | null;
  gates: { gate: string; ok: boolean; detail: string }[];
  gates_passed: boolean;
  failed_gates: string[];
  auto_execution_enabled: boolean;
  human_approval_mandatory: boolean;
  is_decision: boolean;
  note: string;
}
export const advanceLadder = (currentRung: string, approve: boolean, s?: AbortSignal) =>
  post<LadderAdvanceResp>(
    `/console/investment-os/advance?current_rung=${encodeURIComponent(currentRung)}&approve=${approve}`, s);
