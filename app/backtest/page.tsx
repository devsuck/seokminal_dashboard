"use client";

import { useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ApiError, getBars, getBacktest, type BarOut, type BacktestResponse } from "@/lib/api";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:    { padding: 20 },
  header:  { color: "#ff8c00", fontSize: 13, letterSpacing: 1, marginBottom: 16 },
  toolbar: { display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" as const },
  btn:     { background: "#ff8c00", color: "#000", border: "none", padding: "5px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: "bold" as const, cursor: "pointer" },
  label:   { color: "#ff8c00", fontSize: 13 },
  err:     { color: "#ff3333", fontSize: 13 },
  muted:   { color: "#777", fontSize: 13 },
  th:      { padding: "6px 16px 6px 0", color: "#ff8c00", fontSize: 12, fontWeight: "normal" as const, textAlign: "left" as const, borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap" as const },
  td:      { padding: "7px 16px 7px 0", fontSize: 13, fontFamily: "monospace", borderBottom: "1px solid #181818" },
};

const iSm = { background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#e8e8e8", padding: "3px 6px", fontFamily: "inherit", fontSize: 12 } as const;
const lSm = { color: "#666", fontSize: 11 } as const;

// ── Constants ─────────────────────────────────────────────────────────────────
const BENCHMARKS = [
  { value: "", label: "— NONE —" },
  { value: "SPY.ARCA",    label: "SPY (S&P500)" },
  { value: "QQQ.NASDAQ",  label: "QQQ (NASDAQ100)" },
  { value: "005930.XKRX", label: "삼성전자" },
];

const TIMEFRAMES = ["1D", "1W", "1M", "1Q"];
const INDICATORS  = ["RSI", "MA", "BB", "MACD", "CCI", "OBV"] as const;
const OPS         = ["<", "<=", ">", ">=", "=="] as const;
const MA_TYPES    = ["SIMPLE", "EXPONENTIAL", "WEIGHTED"] as const;
const BB_BANDS    = ["upper", "middle", "lower"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type IndicatorType = typeof INDICATORS[number];
type MAType        = typeof MA_TYPES[number];
type BBBand        = typeof BB_BANDS[number];
type CompOp        = typeof OPS[number];
type Combinator    = "AND" | "OR";
type Mode          = "single" | "composite";

interface IndicatorOp {
  indicator:   IndicatorType;
  period:      number;
  ma_type:     MAType;
  k:           number;
  band:        BBBand;
  fast_period: number;
  slow_period: number;
}

interface CompRow {
  id:             string;
  left:           IndicatorOp;
  op:             CompOp;
  rightType:      "literal" | "indicator";
  rightLiteral:   number;
  rightIndicator: IndicatorOp;
}

interface SpawnRuleState {
  id:          string;
  combinator:  Combinator;
  comparisons: CompRow[];
  fast:        number;
  slow:        number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────
function defaultInd(indicator: IndicatorType): IndicatorOp {
  return { indicator, period: 14, ma_type: "EXPONENTIAL", k: 2, band: "middle", fast_period: 12, slow_period: 26 };
}
function newComp(): CompRow {
  return { id: crypto.randomUUID(), left: defaultInd("RSI"), op: "<", rightType: "literal", rightLiteral: 30, rightIndicator: defaultInd("MA") };
}
function newRule(): SpawnRuleState {
  return { id: crypto.randomUUID(), combinator: "AND", comparisons: [newComp()], fast: 10, slow: 20 };
}

// ── JSON Serialization ────────────────────────────────────────────────────────
function indToJson(op: IndicatorOp, barType: string) {
  const p: Record<string, unknown> = {};
  if (["RSI", "MA", "BB", "CCI", "OBV"].includes(op.indicator)) p.period = op.period;
  if (["MA", "BB"].includes(op.indicator)) p.ma_type = op.ma_type;
  if (op.indicator === "BB") { p.k = op.k; p.band = op.band; }
  if (op.indicator === "MACD") { p.fast_period = op.fast_period; p.slow_period = op.slow_period; }
  return { indicator: op.indicator, bar_type: barType, params: p };
}

function buildSpawnRules(rules: SpawnRuleState[], instrumentId: string) {
  const barType = `${instrumentId}-1-DAY-LAST-EXTERNAL`;
  return rules.map(r => ({
    condition: {
      combinator: r.combinator,
      conditions: r.comparisons.map(c => ({
        left: indToJson(c.left, barType),
        op: c.op,
        right: c.rightType === "literal"
          ? { value: c.rightLiteral }
          : indToJson(c.rightIndicator, barType),
      })),
    },
    strategy: {
      class: "backtest_runner.ema_cross_flat:EMACrossFlat",
      params: {
        instrument_id: instrumentId,
        bar_type: barType,
        trade_size: 10,
        fast_ema_period: r.fast,
        slow_ema_period: r.slow,
        request_bars: false,
        subscribe_trade_ticks: false,
      },
    },
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────
function IndSelect({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  return (
    <select value={op.indicator} style={iSm}
      onChange={e => onChange(defaultInd(e.target.value as IndicatorType))}>
      {INDICATORS.map(i => <option key={i}>{i}</option>)}
    </select>
  );
}

function IndParams({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  const upd = (patch: Partial<IndicatorOp>) => onChange({ ...op, ...patch });
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {["RSI", "MA", "BB", "CCI"].includes(op.indicator) && (
        <>
          <span style={lSm}>P</span>
          <input type="number" value={op.period} min={1} style={{ ...iSm, width: 40 }}
            onChange={e => upd({ period: Number(e.target.value) })} />
        </>
      )}
      {["MA", "BB"].includes(op.indicator) && (
        <select value={op.ma_type} style={iSm}
          onChange={e => upd({ ma_type: e.target.value as MAType })}>
          <option value="SIMPLE">SMA</option>
          <option value="EXPONENTIAL">EMA</option>
          <option value="WEIGHTED">WMA</option>
        </select>
      )}
      {op.indicator === "BB" && (
        <>
          <span style={lSm}>K</span>
          <input type="number" value={op.k} step={0.1} min={0.1} style={{ ...iSm, width: 40 }}
            onChange={e => upd({ k: Number(e.target.value) })} />
          <select value={op.band} style={iSm}
            onChange={e => upd({ band: e.target.value as BBBand })}>
            {BB_BANDS.map(b => <option key={b} value={b}>{b === "upper" ? "↑ upper" : b === "middle" ? "─ mid" : "↓ lower"}</option>)}
          </select>
        </>
      )}
      {op.indicator === "MACD" && (
        <>
          <span style={lSm}>F</span>
          <input type="number" value={op.fast_period} min={1} style={{ ...iSm, width: 40 }}
            onChange={e => upd({ fast_period: Number(e.target.value) })} />
          <span style={lSm}>S</span>
          <input type="number" value={op.slow_period} min={1} style={{ ...iSm, width: 40 }}
            onChange={e => upd({ slow_period: Number(e.target.value) })} />
        </>
      )}
    </span>
  );
}

function CompRowUI({ row, onChange, onRemove, isOnly }: {
  row: CompRow;
  onChange: (r: CompRow) => void;
  onRemove: () => void;
  isOnly: boolean;
}) {
  const upd = (patch: Partial<CompRow>) => onChange({ ...row, ...patch });
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
      {/* Left */}
      <IndSelect op={row.left} onChange={left => upd({ left })} />
      <IndParams op={row.left} onChange={left => upd({ left })} />
      {/* Op */}
      <select value={row.op} style={{ ...iSm, width: 46 }}
        onChange={e => upd({ op: e.target.value as CompOp })}>
        {OPS.map(o => <option key={o}>{o}</option>)}
      </select>
      {/* Right type toggle */}
      <select value={row.rightType} style={iSm}
        onChange={e => upd({ rightType: e.target.value as "literal" | "indicator" })}>
        <option value="literal">VALUE</option>
        <option value="indicator">INDICATOR</option>
      </select>
      {/* Right value */}
      {row.rightType === "literal" ? (
        <input type="number" value={row.rightLiteral} style={{ ...iSm, width: 60 }}
          onChange={e => upd({ rightLiteral: Number(e.target.value) })} />
      ) : (
        <>
          <IndSelect op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
          <IndParams op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
        </>
      )}
      {/* Remove */}
      {!isOnly && (
        <button onClick={onRemove} style={{ ...iSm, color: "#ff3333", cursor: "pointer", border: "none", background: "transparent", fontSize: 14, padding: "0 4px" }}>×</button>
      )}
    </div>
  );
}

function SpawnRuleCard({ rule, onChange, onRemove, index }: {
  rule: SpawnRuleState;
  onChange: (r: SpawnRuleState) => void;
  onRemove: () => void;
  index: number;
}) {
  const upd = (patch: Partial<SpawnRuleState>) => onChange({ ...rule, ...patch });

  function updComp(id: string, updated: CompRow) {
    upd({ comparisons: rule.comparisons.map(c => c.id === id ? updated : c) });
  }
  function removeComp(id: string) {
    upd({ comparisons: rule.comparisons.filter(c => c.id !== id) });
  }
  function addComp() {
    upd({ comparisons: [...rule.comparisons, newComp()] });
  }

  return (
    <div style={{ border: "1px solid #2a2a2a", padding: "14px 16px", marginBottom: 12, background: "#0a0a0a" }}>
      {/* Rule header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ color: "#ff8c00", fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>RULE {index + 1}</span>
        <span style={lSm}>COMBINATOR</span>
        <select value={rule.combinator} style={iSm}
          onChange={e => upd({ combinator: e.target.value as Combinator })}>
          <option>AND</option>
          <option>OR</option>
        </select>
        <button onClick={onRemove} style={{ marginLeft: "auto", ...iSm, color: "#ff3333", cursor: "pointer", border: "1px solid #2a2a2a", fontSize: 12 }}>
          REMOVE RULE
        </button>
      </div>

      {/* Conditions */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#666", fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>CONDITIONS</div>
        {rule.comparisons.map((c, i) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && (
              <span style={{ color: "#ff8c00", fontSize: 11, width: 28, flexShrink: 0 }}>{rule.combinator}</span>
            )}
            {i === 0 && <span style={{ width: 28, flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <CompRowUI row={c} onChange={r => updComp(c.id, r)} onRemove={() => removeComp(c.id)} isOnly={rule.comparisons.length === 1} />
            </div>
          </div>
        ))}
        <button onClick={addComp} style={{ ...iSm, marginTop: 8, cursor: "pointer", color: "#aaa", fontSize: 12 }}>
          + ADD CONDITION
        </button>
      </div>

      {/* Trigger strategy */}
      <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" as const }}>
        <span style={{ color: "#666", fontSize: 11, letterSpacing: 1 }}>TRIGGER</span>
        <span style={{ color: "#aaa", fontSize: 12, background: "#111", border: "1px solid #2a2a2a", padding: "3px 10px" }}>EMA CROSS</span>
        <span style={lSm}>FAST</span>
        <input type="number" value={rule.fast} min={1} style={{ ...iSm, width: 52 }}
          onChange={e => upd({ fast: Number(e.target.value) })} />
        <span style={lSm}>SLOW</span>
        <input type="number" value={rule.slow} min={1} style={{ ...iSm, width: 52 }}
          onChange={e => upd({ slow: Number(e.target.value) })} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dash(v: number | null | undefined, fmt: (n: number) => string): string {
  return v == null ? "—" : fmt(v);
}
function pnlColor(v: number | null | undefined) { return v == null ? "#444" : v >= 0 ? "#00cc44" : "#ff3333"; }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BacktestPage() {
  const [mode, setMode]             = useState<Mode>("single");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]           = useState("2025-06-25");
  const [end, setEnd]               = useState("2026-06-23");
  const [timeframe, setTimeframe]   = useState("1D");
  const [fast, setFast]             = useState(10);
  const [slow, setSlow]             = useState(20);
  const [benchmarkId, setBenchmarkId] = useState("");
  const [rules, setRules]           = useState<SpawnRuleState[]>([newRule()]);
  const [bars, setBars]             = useState<BarOut[]>([]);
  const [result, setResult]         = useState<BacktestResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function updRule(id: string, updated: SpawnRuleState) {
    setRules(rs => rs.map(r => r.id === id ? updated : r));
  }
  function removeRule(id: string) {
    setRules(rs => rs.filter(r => r.id !== id));
  }
  function addRule() {
    setRules(rs => [...rs, newRule()]);
  }

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      let strategy: string;
      let strategyParams: Record<string, string>;
      if (mode === "single") {
        strategy = "ema_cross";
        strategyParams = { fast: String(fast), slow: String(slow) };
      } else {
        if (rules.length === 0) { setError("최소 1개 이상의 Rule 필요"); setLoading(false); return; }
        strategy = "gated";
        strategyParams = { spawn_rules: JSON.stringify(buildSpawnRules(rules, instrumentId)) };
      }
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, timeframe, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, strategyParams, benchmarkId || undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setResult(btRes);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setBars([]); setResult(null);
    } finally { setLoading(false); }
  }

  const stats = [
    { label: "TOTAL PNL",   val: dash(result?.total_pnl, n => n.toFixed(2)),                              col: pnlColor(result?.total_pnl) },
    { label: "TOTAL PNL %", val: dash(result?.total_pnl_pct, n => (n * 100).toFixed(2) + "%"),            col: pnlColor(result?.total_pnl_pct) },
    { label: "SHARPE",      val: dash(result?.sharpe_ratio, n => n.toFixed(3)),                            col: pnlColor(result?.sharpe_ratio) },
    { label: "SORTINO",     val: dash(result?.sortino_ratio, n => n.toFixed(3)),                           col: pnlColor(result?.sortino_ratio) },
    { label: "VOLATILITY",  val: dash(result?.volatility, n => (n * 100).toFixed(2) + "%"),               col: "#e8e8e8" },
    { label: "MAX DD",      val: result?.max_drawdown != null ? (result.max_drawdown * 100).toFixed(2) + "%" : "—", col: result?.max_drawdown != null ? "#ff3333" : "#444" },
    { label: "BETA",        val: dash(result?.beta, n => n.toFixed(3)),                                    col: result?.beta != null ? "#e8e8e8" : "#444" },
    { label: "WIN RATE",    val: dash(result?.win_rate, n => (n * 100).toFixed(1) + "%"),                  col: pnlColor(result?.win_rate ? result.win_rate - 0.5 : null) },
    { label: "P/L RATIO",   val: dash(result?.profit_loss_ratio, n => n.toFixed(2)),                      col: pnlColor(result?.profit_loss_ratio ? result.profit_loss_ratio - 1 : null) },
    { label: "AVG WIN",     val: dash(result?.avg_win, n => n.toFixed(2)),                                 col: "#00cc44" },
    { label: "AVG LOSS",    val: dash(result?.avg_loss, n => n.toFixed(2)),                                col: "#ff3333" },
    { label: "TRADES",      val: result ? String(result.trades.length) : "—",                              col: "#e8e8e8" },
    { label: "BARS",        val: result ? String(result.bar_count) : "—",                                  col: "#555" },
  ];

  return (
    <div style={S.page}>
      <div style={S.header}>STRATEGY BACKTEST LAB</div>

      {/* ── Mode Toggle ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #2a2a2a" }}>
        {(["single", "composite"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "6px 20px", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
            background: "transparent", border: "none",
            borderBottom: mode === m ? "2px solid #ff8c00" : "2px solid transparent",
            color: mode === m ? "#ff8c00" : "#777",
            fontWeight: mode === m ? "bold" : "normal",
            marginBottom: -1,
          }}>
            {m === "single" ? "SINGLE STRATEGY" : "COMPOSITE / GATED"}
          </button>
        ))}
      </div>

      {/* ── Single Mode ── */}
      {mode === "single" && (
        <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "14px 16px", marginBottom: 20 }}>
          <div style={S.toolbar}>
            <span style={S.label}>SYMBOL</span>
            <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
            <span style={S.label}>DATE</span>
            <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
            <span style={S.label}>TF</span>
            <div style={{ display: "flex", gap: 2 }}>
              {TIMEFRAMES.map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} style={{
                  padding: "4px 8px", fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                  background: timeframe === tf ? "#ff8c00" : "transparent",
                  color: timeframe === tf ? "#000" : "#777",
                  border: "1px solid " + (timeframe === tf ? "#ff8c00" : "#2a2a2a"),
                  fontWeight: timeframe === tf ? "bold" : "normal",
                }}>{tf}</button>
              ))}
            </div>
          </div>
          <div style={{ ...S.toolbar, marginBottom: 0 }}>
            <span style={S.label}>STRATEGY</span>
            <span style={{ color: "#aaa", fontSize: 12, background: "#111", border: "1px solid #2a2a2a", padding: "4px 12px" }}>EMA CROSS</span>
            <span style={S.label}>FAST</span>
            <input type="number" value={fast} onChange={e => setFast(Number(e.target.value))} style={{ width: 52 }} min={1} />
            <span style={S.label}>SLOW</span>
            <input type="number" value={slow} onChange={e => setSlow(Number(e.target.value))} style={{ width: 52 }} min={1} />
            <span style={S.label}>BENCH (β)</span>
            <select value={benchmarkId} onChange={e => setBenchmarkId(e.target.value)} style={{ fontFamily: "inherit" }}>
              {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <button style={S.btn} onClick={run}>{loading ? "RUNNING..." : "RUN"}</button>
          </div>
        </div>
      )}

      {/* ── Composite Mode ── */}
      {mode === "composite" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#777", fontSize: 12, marginBottom: 16 }}>
            각 Rule = 조건(AND/OR) + 전략. 조건 충족 시 전략 실행. 빈 조건 = 항상 실행.
          </div>

          {rules.map((r, i) => (
            <SpawnRuleCard key={r.id} rule={r} index={i}
              onChange={updated => updRule(r.id, updated)}
              onRemove={() => removeRule(r.id)} />
          ))}

          <button onClick={addRule} style={{ ...S.btn, background: "transparent", color: "#ff8c00", border: "1px solid #ff8c00", marginBottom: 20 }}>
            + ADD RULE
          </button>

          {/* Global config for composite */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "14px 16px" }}>
            <div style={S.toolbar}>
              <span style={S.label}>SYMBOL</span>
              <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
              <span style={S.label}>DATE</span>
              <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
              <span style={S.label}>TF</span>
              <div style={{ display: "flex", gap: 2 }}>
                {TIMEFRAMES.map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)} style={{
                    padding: "4px 8px", fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                    background: timeframe === tf ? "#ff8c00" : "transparent",
                    color: timeframe === tf ? "#000" : "#777",
                    border: "1px solid " + (timeframe === tf ? "#ff8c00" : "#2a2a2a"),
                    fontWeight: timeframe === tf ? "bold" : "normal",
                  }}>{tf}</button>
                ))}
              </div>
              <span style={S.label}>BENCH (β)</span>
              <select value={benchmarkId} onChange={e => setBenchmarkId(e.target.value)} style={{ fontFamily: "inherit" }}>
                {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <button style={S.btn} onClick={run} disabled={loading}>{loading ? "RUNNING..." : "RUN COMPOSITE"}</button>
            </div>
          </div>

          {/* JSON preview */}
          {rules.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ color: "#555", fontSize: 12, cursor: "pointer" }}>spawn_rules JSON 미리보기</summary>
              <pre style={{ background: "#080808", border: "1px solid #1e1e1e", padding: 12, fontSize: 11, color: "#666", overflow: "auto", marginTop: 8, maxHeight: 200 }}>
                {JSON.stringify(buildSpawnRules(rules, instrumentId), null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {error && <p style={S.err}>ERR: {error}</p>}

      {/* ── Stats Grid ── */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap", padding: "14px 16px", background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
        {stats.map(s => (
          <div key={s.label} style={{ minWidth: 82 }}>
            <div style={{ color: "#888", fontSize: 11, letterSpacing: 0.5, marginBottom: 5 }}>{s.label}</div>
            <div style={{ color: s.col, fontSize: 17, fontFamily: "monospace", fontWeight: "bold" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ marginBottom: 16 }}>
        {mode === "single" && (
          <div style={{ display: "flex", gap: 20, marginBottom: 8, fontSize: 12, color: "#777" }}>
            <span><span style={{ color: "#ff8c00" }}>—</span> EMA {fast}</span>
            <span><span style={{ color: "#4488ff" }}>—</span> EMA {slow}</span>
            <span><span style={{ color: "#00cc44" }}>▲</span> BUY</span>
            <span><span style={{ color: "#ff3333" }}>▼</span> SELL</span>
          </div>
        )}
        {bars.length > 0 && result ? (
          <CandlestickChart bars={bars} trades={result.trades}
            emaFast={mode === "single" ? fast : undefined}
            emaSlow={mode === "single" ? slow : undefined} />
        ) : (
          <div style={{ width: "100%", height: 300, background: "#0a0a0a", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#444", fontSize: 13 }}>RUN BACKTEST TO SEE CHART</span>
          </div>
        )}
      </div>

      {/* ── Trade Log ── */}
      <div style={{ marginTop: 24 }}>
        <div style={{ color: "#ff8c00", fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>
          TRADE LOG {result ? `(${result.trades.length})` : ""}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
            <thead>
              <tr>
                {["#", "SIDE", "ENTRY DATE", "ENTRY PRICE", "EXIT DATE", "EXIT PRICE", "QTY", "PNL"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result && result.trades.length > 0 ? result.trades.map((t, i) => {
                const entryDate = new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10);
                const exitDate = t.exit_ts_ns ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10) : "—";
                return (
                  <tr key={i}>
                    <td style={{ ...S.td, color: "#555" }}>{i + 1}</td>
                    <td style={{ ...S.td, color: t.side === "LONG" ? "#00cc44" : "#ff8c00" }}>{t.side}</td>
                    <td style={{ ...S.td, color: "#888" }}>{entryDate}</td>
                    <td style={{ ...S.td, color: "#e8e8e8" }}>{t.entry_price.toFixed(2)}</td>
                    <td style={{ ...S.td, color: "#888" }}>{exitDate}</td>
                    <td style={{ ...S.td, color: "#e8e8e8" }}>{t.exit_price?.toFixed(2) ?? "—"}</td>
                    <td style={{ ...S.td, color: "#888" }}>{t.qty.toFixed(0)}</td>
                    <td style={{ ...S.td, color: pnlColor(t.pnl), fontWeight: "bold" }}>
                      {t.pnl != null ? t.pnl.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} style={{ ...S.td, color: "#444", textAlign: "center", padding: 24 }}>NO TRADES</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
