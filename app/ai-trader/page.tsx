"use client";

const S = {
  page: { padding: 20 },
  header: { color: "#ff8c00", fontSize: 13, letterSpacing: 1, marginBottom: 24 },
  box: {
    border: "1px solid #2a2a2a",
    padding: 28,
    maxWidth: 640,
    background: "#0d0d0d",
  },
  title: { color: "#ff8c00", fontSize: 15, fontWeight: "bold" as const, marginBottom: 14 },
  badge: {
    display: "inline-block",
    background: "#1a1a1a",
    color: "#777",
    border: "1px solid #333",
    padding: "3px 12px",
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 18,
  },
  desc: { color: "#888", fontSize: 14, lineHeight: 2 },
  featureList: { margin: "16px 0", paddingLeft: 0, listStyle: "none" as const },
  feature: { color: "#aaa", fontSize: 13, padding: "4px 0", display: "flex" as const, gap: 8 },
  dot: { color: "#ff8c00" },
};

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
    <div style={S.page}>
      <div style={S.header}>AI AUTONOMOUS TRADER</div>
      <div style={S.box}>
        <div style={S.badge}>UNDER DEVELOPMENT</div>
        <div style={S.title}>AGENTIC TRADING SYSTEM</div>
        <p style={S.desc}>
          Multi-agent AI framework for fully autonomous trading.<br />
          Currently in design phase — implementation begins after quant suite stabilization.
        </p>
        <ul style={S.featureList}>
          {PLANNED_FEATURES.map(f => (
            <li key={f} style={S.feature}>
              <span style={S.dot}>›</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
