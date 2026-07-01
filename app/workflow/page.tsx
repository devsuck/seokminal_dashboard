"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { getWorkflow, clearWorkflow, getWorkflowStep } from "@/lib/workflow-storage";
import type { WorkflowState, WorkflowStep } from "@/lib/workflow-storage";

interface StepDef {
  id: WorkflowStep | "factor";
  label: string;
  description: string;
  href: string;
  actionLabel: string;
}

const STEP_DEFS: StepDef[] = [
  {
    id: "universe",
    label: "1. Universe",
    description: "Browse KRX and US listings. Add instruments to your watchlist to define the trading universe.",
    href: "/universe",
    actionLabel: "Browse Universe →",
  },
  {
    id: "factor",
    label: "2. Factor Analysis",
    description: "Analyse momentum, volatility, and Spearman IC across instruments. Optional — skip to strategy if ready.",
    href: "/quant",
    actionLabel: "Analyse Factors →",
  },
  {
    id: "strategy",
    label: "3. Strategy",
    description: "Select a saved strategy and proceed to backtest it against your universe.",
    href: "/notebooks",
    actionLabel: "Select Strategy →",
  },
  {
    id: "portfolio",
    label: "4. Backtest",
    description: "Run the strategy over historical data. Results are saved to the workflow automatically.",
    href: "/backtest",
    actionLabel: "Run Backtest →",
  },
  {
    id: "portfolio",
    label: "5. Portfolio",
    description: "Optimise weights using Markowitz / Max-Sharpe across the universe instruments.",
    href: "/portfolio",
    actionLabel: "Optimise Portfolio →",
  },
  {
    id: "bots",
    label: "6. Deploy Bot",
    description: "Deploy an automated trading bot using the optimised strategy and weights.",
    href: "/bots",
    actionLabel: "Deploy Bot →",
  },
];

function stepIndex(step: WorkflowStep): number {
  switch (step) {
    case "universe": return 0;
    case "strategy": return 2;
    case "portfolio": return 4;
    case "bots": return 5;
  }
}

export default function WorkflowPage() {
  const [state, setState] = useState<WorkflowState | null>(() => getWorkflow());

  const currentStep = getWorkflowStep(state);
  const currentIdx = stepIndex(currentStep);

  const handleReset = useCallback(() => {
    clearWorkflow();
    setState(null);
  }, []);

  function stepStatus(defIdx: number): "done" | "current" | "pending" {
    if (defIdx < currentIdx) return "done";
    if (defIdx === currentIdx) return "current";
    return "pending";
  }

  const progressPct = Math.round((currentIdx / (STEP_DEFS.length - 1)) * 100);

  return (
    <div className="p-6 space-y-6 max-w-[760px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Workflow</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Guided pipeline: Universe → Factor → Strategy → Backtest → Portfolio → Bot.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-1 text-xs text-text-3 hover:text-neg border border-border hover:border-neg/40 px-3 py-1.5 rounded transition-colors bg-transparent cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* Horizontal progress stepper */}
      <div className="bg-panel border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-3 text-[10px] uppercase tracking-wider">진행률</span>
          <span className="text-accent text-xs font-data font-semibold">{progressPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-panel-2 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Step nodes + connectors */}
        <div className="flex items-center">
          {STEP_DEFS.map((def, idx) => {
            const status = stepStatus(idx);
            const isLast = idx === STEP_DEFS.length - 1;
            return (
              <div key={idx} className="flex items-center flex-1 last:flex-none">
                <Link
                  href={def.href}
                  className="flex flex-col items-center gap-1.5 no-underline group shrink-0"
                  title={def.label}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors ${
                      status === "done"
                        ? "bg-pos/20 text-pos border-pos/40"
                        : status === "current"
                        ? "bg-accent/20 text-accent border-accent group-hover:bg-accent/30"
                        : "bg-panel-2 text-text-3 border-border group-hover:border-text-3"
                    }`}
                  >
                    {status === "done" ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-[9px] whitespace-nowrap transition-colors ${
                      status === "current" ? "text-accent font-semibold"
                      : status === "done" ? "text-text-2"
                      : "text-text-3 group-hover:text-text-2"
                    }`}
                  >
                    {def.label.replace(/^\d+\.\s*/, "")}
                  </span>
                </Link>
                {!isLast && (
                  <div className="flex-1 h-0.5 mx-1 -mt-5 rounded-full overflow-hidden bg-panel-2">
                    <div
                      className={`h-full transition-colors ${idx < currentIdx ? "bg-pos/40" : "bg-transparent"}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current state summary */}
      {state && (
        <div className="bg-panel border border-border rounded-lg p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Instruments</div>
            <div className="text-text-1 text-sm font-data mt-1">{state.instrumentIds.length}</div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Strategy</div>
            <div className="text-text-1 text-sm font-data mt-1 truncate">{state.strategyId ? "Selected" : "—"}</div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Backtest Sharpe</div>
            <div className={`text-sm font-data mt-1 ${state.backtestSharpe !== null ? (state.backtestSharpe >= 1 ? "text-pos" : "text-neg") : "text-text-3"}`}>
              {state.backtestSharpe !== null ? state.backtestSharpe.toFixed(2) : "—"}
            </div>
          </div>
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Portfolio</div>
            <div className="text-text-1 text-sm font-data mt-1">
              {state.portfolioWeights ? `${Object.keys(state.portfolioWeights).length} assets` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-0">
        {STEP_DEFS.map((def, idx) => {
          const status = stepStatus(idx);
          const isLast = idx === STEP_DEFS.length - 1;
          return (
            <div key={idx} className="flex gap-3">
              {/* Timeline rail */}
              <div className="flex flex-col items-center shrink-0 pt-4">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                    status === "done"
                      ? "bg-pos/20 text-pos border-pos/40"
                      : status === "current"
                      ? "bg-accent/20 text-accent border-accent"
                      : "bg-panel-2 text-text-3 border-border"
                  }`}
                >
                  {status === "done" ? "✓" : idx + 1}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-1 ${idx < currentIdx ? "bg-pos/30" : "bg-border"}`} />
                )}
              </div>

              {/* Card */}
              <div
                className={`flex-1 mb-2 bg-panel border rounded-lg p-4 transition-colors ${
                  status === "current" ? "border-accent/40" : "border-border"
                }`}
              >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${status === "pending" ? "text-text-3" : "text-text-1"}`}>
                      {def.label}
                    </span>
                    {status === "done" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pos/10 text-pos">Done</span>
                    )}
                    {status === "current" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Current</span>
                    )}
                  </div>
                  <p className="text-text-3 text-xs mt-1 leading-relaxed">{def.description}</p>
                </div>

                <Link
                  href={def.href}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded no-underline transition-colors whitespace-nowrap ${
                    status === "current"
                      ? "bg-accent text-black font-semibold hover:brightness-110"
                      : "border border-border text-text-3 hover:text-text-1 hover:border-accent/50"
                  }`}
                >
                  {def.actionLabel}
                </Link>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {!state && (
        <div className="text-center py-4 text-text-3 text-sm">
          Start by browsing the Universe and adding instruments to your watchlist.
        </div>
      )}
    </div>
  );
}
