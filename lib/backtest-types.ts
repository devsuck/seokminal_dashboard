// ── Constants ──────────────────────────────────────────────────────
export const BENCHMARKS = [
  { value: "",             label: "— None —" },
  { value: "SPY.ARCA",    label: "SPY (S&P 500)" },
  { value: "QQQ.NASDAQ",  label: "QQQ (NASDAQ 100)" },
  { value: "005930.XKRX", label: "Samsung Electronics" },
];

export const TIMEFRAMES = ["1D", "1W", "1M", "1Q"] as const;
export const INDICATORS  = ["RSI", "MA", "BB", "MACD", "CCI", "OBV"] as const;
export const OPS         = ["<", "<=", ">", ">=", "=="] as const;
export const MA_TYPES    = ["SIMPLE", "EXPONENTIAL", "WEIGHTED"] as const;
export const BB_BANDS    = ["upper", "middle", "lower"] as const;

// ── Types ──────────────────────────────────────────────────────────
export type IndicatorType = typeof INDICATORS[number];
export type MAType        = typeof MA_TYPES[number];
export type BBBand        = typeof BB_BANDS[number];
export type CompOp        = typeof OPS[number];
export type Combinator    = "AND" | "OR";
export type Mode          = "composite" | "portfolio";

export interface IndicatorOp {
  indicator:   IndicatorType;
  period:      number;
  ma_type:     MAType;
  k:           number;
  band:        BBBand;
  fast_period: number;
  slow_period: number;
}

export interface CompRow {
  id:             string;
  left:           IndicatorOp;
  op:             CompOp;
  rightType:      "literal" | "indicator";
  rightLiteral:   number;
  rightIndicator: IndicatorOp;
}

export interface SpawnRuleState {
  id:          string;
  combinator:  Combinator;
  comparisons: CompRow[];
  fast:        number;
  slow:        number;
}

// ── Factories ──────────────────────────────────────────────────────
export function defaultInd(indicator: IndicatorType): IndicatorOp {
  return {
    indicator,
    period: 14,
    ma_type: "EXPONENTIAL",
    k: 2,
    band: "middle",
    fast_period: 12,
    slow_period: 26,
  };
}

export function newComp(): CompRow {
  return {
    id: crypto.randomUUID(),
    left: defaultInd("RSI"),
    op: "<",
    rightType: "literal",
    rightLiteral: 30,
    rightIndicator: defaultInd("MA"),
  };
}

export function newRule(): SpawnRuleState {
  return {
    id: crypto.randomUUID(),
    combinator: "AND",
    comparisons: [newComp()],
    fast: 10,
    slow: 20,
  };
}

export function ruleFromNlResult(result: {
  combinator: Combinator;
  comparisons: {
    left: IndicatorOp;
    op: CompOp;
    rightType: "literal" | "indicator";
    rightLiteral: number;
    rightIndicator: IndicatorOp;
  }[];
  fast: number;
  slow: number;
}): SpawnRuleState {
  return {
    id: crypto.randomUUID(),
    combinator: result.combinator,
    comparisons: result.comparisons.map(c => ({
      id: crypto.randomUUID(),
      left: c.left,
      op: c.op,
      rightType: c.rightType,
      rightLiteral: c.rightLiteral,
      rightIndicator: c.rightIndicator,
    })),
    fast: result.fast,
    slow: result.slow,
  };
}

// ── UI Helpers ─────────────────────────────────────────────────────
export function pnlClass(v: number | null | undefined): string {
  return v == null ? "text-text-3" : v >= 0 ? "text-pos" : "text-neg";
}

// ── 차트 지표 스펙 — 조건식에 쓰인 지표를 차트에 그대로 표시 ────────
export type ChartIndicatorSpec =
  | { kind: "MA"; period: number; maType: MAType }
  | { kind: "BB"; period: number; k: number }
  | { kind: "EMA_CROSS"; fast: number; slow: number }
  | { kind: "RSI"; period: number }
  | { kind: "MACD"; fast: number; slow: number }
  | { kind: "CCI"; period: number }
  | { kind: "OBV" };

export function specLabel(s: ChartIndicatorSpec): string {
  switch (s.kind) {
    case "MA":        return `${s.maType === "SIMPLE" ? "SMA" : "EMA"} ${s.period}`;
    case "BB":        return `BB ${s.period}/${s.k}σ`;
    case "EMA_CROSS": return `EMA ${s.fast}/${s.slow}`;
    case "RSI":       return `RSI ${s.period}`;
    case "MACD":      return `MACD ${s.fast}/${s.slow}`;
    case "CCI":       return `CCI ${s.period}`;
    case "OBV":       return "OBV";
  }
}

function specFromIndicatorOp(op: IndicatorOp): ChartIndicatorSpec | null {
  switch (op.indicator) {
    case "MA":   return { kind: "MA", period: op.period, maType: op.ma_type };
    case "BB":   return { kind: "BB", period: op.period, k: op.k };
    case "RSI":  return { kind: "RSI", period: op.period };
    case "MACD": return { kind: "MACD", fast: op.fast_period, slow: op.slow_period };
    case "CCI":  return { kind: "CCI", period: op.period };
    case "OBV":  return { kind: "OBV" };
    default:     return null;
  }
}

/** 조건식 Rule들에서 차트에 그릴 지표 스펙 추출 (좌변 + 지표 우변 + 전략 EMA 크로스, 중복 제거). */
export function chartSpecsFromRules(rules: SpawnRuleState[]): ChartIndicatorSpec[] {
  const specs: ChartIndicatorSpec[] = [];
  const seen = new Set<string>();
  const push = (s: ChartIndicatorSpec | null) => {
    if (!s) return;
    const key = JSON.stringify(s);
    if (!seen.has(key)) { seen.add(key); specs.push(s); }
  };
  for (const r of rules) {
    for (const c of r.comparisons) {
      push(specFromIndicatorOp(c.left));
      if (c.rightType === "indicator") push(specFromIndicatorOp(c.rightIndicator));
    }
    push({ kind: "EMA_CROSS", fast: r.fast, slow: r.slow });
  }
  return specs;
}

// ── JSON Serialization (preserved exactly from original) ───────────
export function indToJson(op: IndicatorOp, barType: string) {
  const p: Record<string, unknown> = {};
  if (["RSI", "MA", "BB", "CCI", "OBV"].includes(op.indicator)) p.period = op.period;
  if (["MA", "BB"].includes(op.indicator)) p.ma_type = op.ma_type;
  if (op.indicator === "BB") { p.k = op.k; p.band = op.band; }
  if (op.indicator === "MACD") { p.fast_period = op.fast_period; p.slow_period = op.slow_period; }
  return { indicator: op.indicator, bar_type: barType, params: p };
}

export function buildSpawnRules(rules: SpawnRuleState[], instrumentId: string) {
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
