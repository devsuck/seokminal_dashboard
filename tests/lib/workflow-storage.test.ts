import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkflow,
  updateWorkflow,
  clearWorkflow,
  getWorkflowStep,
  type WorkflowState,
} from "../../lib/workflow-storage";

describe("getWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns null when storage is empty", () => {
    expect(getWorkflow()).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem("nautilus:workflow", "NOT{JSON");
    expect(getWorkflow()).toBeNull();
  });
});

describe("updateWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("creates new state with instrumentIds when nothing exists", () => {
    const state = updateWorkflow({ instrumentIds: ["005930.XKRX"] });
    expect(state.instrumentIds).toEqual(["005930.XKRX"]);
    expect(state.strategyId).toBeNull();
    expect(state.backtestSharpe).toBeNull();
    expect(state.backtestPnlPct).toBeNull();
    expect(state.portfolioWeights).toBeNull();
    expect(state.updatedAt).toBeGreaterThan(0);
  });

  it("patches existing state without overwriting other fields", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01" });
    const patched = updateWorkflow({ strategyId: "strat_1_abc12" });
    expect(patched.instrumentIds).toEqual(["AAPL.NASDAQ"]);
    expect(patched.strategyId).toBe("strat_1_abc12");
  });

  it("updates updatedAt on every call", () => {
    const s1 = updateWorkflow({ instrumentIds: [] });
    const s2 = updateWorkflow({ strategyId: "x" });
    expect(s2.updatedAt).toBeGreaterThanOrEqual(s1.updatedAt);
  });

  it("persists to storage (getWorkflow returns it)", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01" });
    const stored = getWorkflow();
    expect(stored?.instrumentIds).toEqual(["AAPL.NASDAQ"]);
  });
});

describe("clearWorkflow", () => {
  beforeEach(() => { localStorage.clear(); });

  it("removes state from storage", () => {
    updateWorkflow({ instrumentIds: ["AAPL.NASDAQ"] });
    clearWorkflow();
    expect(getWorkflow()).toBeNull();
  });
});

describe("getWorkflowStep", () => {
  it("returns 'universe' when state is null", () => {
    expect(getWorkflowStep(null)).toBe("universe");
  });

  it("returns 'universe' when instrumentIds is empty", () => {
    const state: WorkflowState = {
      instrumentIds: [], start: "2023-01-01", end: "2025-01-01",
      strategyId: null, backtestSharpe: null, backtestPnlPct: null,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("universe");
  });

  it("returns 'strategy' when has instruments but no backtest result", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: null, backtestSharpe: null, backtestPnlPct: null,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("strategy");
  });

  it("returns 'portfolio' when has backtestSharpe but no portfolioWeights", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: "strat_1", backtestSharpe: 1.2, backtestPnlPct: 0.15,
      portfolioWeights: null, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("portfolio");
  });

  it("returns 'bots' when portfolioWeights are present", () => {
    const state: WorkflowState = {
      instrumentIds: ["AAPL.NASDAQ", "MSFT.NASDAQ"], start: "2023-01-01", end: "2025-01-01",
      strategyId: "strat_1", backtestSharpe: 1.2, backtestPnlPct: 0.15,
      portfolioWeights: { "AAPL.NASDAQ": 0.6, "MSFT.NASDAQ": 0.4 }, updatedAt: Date.now(),
    };
    expect(getWorkflowStep(state)).toBe("bots");
  });
});
