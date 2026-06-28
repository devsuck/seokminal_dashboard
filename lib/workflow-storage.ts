const STORAGE_KEY = "nautilus:workflow";

export interface WorkflowState {
  instrumentIds: string[];
  start: string;
  end: string;
  strategyId: string | null;
  backtestSharpe: number | null;
  backtestPnlPct: number | null;
  portfolioWeights: Record<string, number> | null;
  updatedAt: number;
}

export type WorkflowStep = "universe" | "strategy" | "portfolio" | "bots";

const DEFAULTS: Omit<WorkflowState, "updatedAt"> = {
  instrumentIds: [],
  start: "2022-01-01",
  end: new Date().toISOString().slice(0, 10),
  strategyId: null,
  backtestSharpe: null,
  backtestPnlPct: null,
  portfolioWeights: null,
};

export function getWorkflow(): WorkflowState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkflowState;
  } catch {
    return null;
  }
}

export function updateWorkflow(patch: Partial<Omit<WorkflowState, "updatedAt">>): WorkflowState {
  const existing = getWorkflow();
  const next: WorkflowState = {
    ...DEFAULTS,
    ...(existing ?? {}),
    ...patch,
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearWorkflow(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getWorkflowStep(state: WorkflowState | null): WorkflowStep {
  if (!state || state.instrumentIds.length === 0) return "universe";
  if (state.backtestSharpe === null && state.backtestPnlPct === null) return "strategy";
  if (state.portfolioWeights === null) return "portfolio";
  return "bots";
}
