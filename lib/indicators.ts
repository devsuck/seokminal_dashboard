// 차트 지표 상태 — ChartTab에서 리프트, MarketWorkspace가 소유하고
// ChartTab(렌더)과 IndicatorTab(관리)이 공유.

export interface IndicatorState {
  sma: { on: boolean; period: number };
  ema: { on: boolean; fast: number; slow: number };
  bb: { on: boolean; period: number; std: number };
  rsi: { on: boolean; period: number };
  macd: { on: boolean; fast: number; slow: number; signal: number };
  stoch: { on: boolean; k: number; d: number };
  cci: { on: boolean; period: number };
  wr: { on: boolean; period: number };
  adx: { on: boolean; period: number };
  atr: { on: boolean; period: number };
  volume: { on: boolean };
  obv: { on: boolean };
}

export type IndicatorKey = keyof IndicatorState;

export const DEFAULT_INDICATORS: IndicatorState = {
  sma: { on: false, period: 20 },
  ema: { on: false, fast: 12, slow: 26 },
  bb: { on: false, period: 20, std: 2 },
  rsi: { on: false, period: 14 },
  macd: { on: false, fast: 12, slow: 26, signal: 9 },
  stoch: { on: false, k: 14, d: 3 },
  cci: { on: false, period: 20 },
  wr: { on: false, period: 14 },
  adx: { on: false, period: 14 },
  atr: { on: false, period: 14 },
  volume: { on: false },
  obv: { on: false },
};

export interface ActiveChip {
  key: IndicatorKey;
  label: string;
}

// 켜진 지표를 칩 라벨 리스트로. ChartTab 상단 칩 표시용.
export function activeIndicatorChips(ind: IndicatorState): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (ind.sma.on) chips.push({ key: "sma", label: `SMA ${ind.sma.period}` });
  if (ind.ema.on) chips.push({ key: "ema", label: `EMA ${ind.ema.fast}/${ind.ema.slow}` });
  if (ind.bb.on) chips.push({ key: "bb", label: `BB ${ind.bb.period}` });
  if (ind.rsi.on) chips.push({ key: "rsi", label: `RSI ${ind.rsi.period}` });
  if (ind.macd.on) chips.push({ key: "macd", label: `MACD ${ind.macd.fast}/${ind.macd.slow}/${ind.macd.signal}` });
  if (ind.stoch.on) chips.push({ key: "stoch", label: `Stoch ${ind.stoch.k}/${ind.stoch.d}` });
  if (ind.cci.on) chips.push({ key: "cci", label: `CCI ${ind.cci.period}` });
  if (ind.wr.on) chips.push({ key: "wr", label: `%R ${ind.wr.period}` });
  if (ind.adx.on) chips.push({ key: "adx", label: `ADX ${ind.adx.period}` });
  if (ind.atr.on) chips.push({ key: "atr", label: `ATR ${ind.atr.period}` });
  if (ind.volume.on) chips.push({ key: "volume", label: "거래량" });
  if (ind.obv.on) chips.push({ key: "obv", label: "OBV" });
  return chips;
}

// 켜진 지표 개수 (탭 뱃지용)
export function activeIndicatorCount(ind: IndicatorState): number {
  return (Object.keys(ind) as IndicatorKey[]).filter(k => ind[k].on).length;
}
