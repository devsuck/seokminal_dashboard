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
export type Mode          = "single" | "composite";

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
