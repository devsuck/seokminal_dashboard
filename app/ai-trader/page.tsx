"use client";

const PLANNED_FEATURES = [
  "LangGraph multi-agent trading orchestration",
  "Autonomous order execution with risk limits",
  "AI journal — decision log + rationale trace",
  "AI vs Me — side-by-side performance comparison",
  "Separate broker account isolation (Alpaca / IB paper)",
  "Real-time signal monitoring & position dashboard",
  "Strategy parameter tuning via LLM feedback loop",
];

export default function AITraderPage() {
  return (
    <div className="p-6 space-y-4 max-w-[760px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">AI Trader</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Agentic trading system — multi-agent AI framework for autonomous execution.
        </p>
      </div>

      <div className="bg-panel border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] px-2 py-1 rounded border border-warn/40 text-warn bg-warn/5 tracking-wider uppercase">
            Under Development
          </span>
        </div>

        <div>
          <h2 className="text-text-1 text-sm font-semibold">Agentic Trading System</h2>
          <p className="text-text-3 text-sm mt-2 leading-relaxed">
            Multi-agent AI framework for fully autonomous trading.
            Currently in design phase — implementation begins after quant suite stabilization.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-text-3 text-[10px] uppercase tracking-wider">Planned Features</div>
          <ul className="space-y-1.5">
            {PLANNED_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-text-2">
                <span className="text-accent mt-0.5 flex-shrink-0">›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
