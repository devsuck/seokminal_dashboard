"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  DEFAULT_INDICATORS,
  activeIndicatorCount,
  type IndicatorState,
  type IndicatorKey,
} from "@/lib/indicators";

interface IndicatorTabProps {
  indicators: IndicatorState;
  setIndicators: Dispatch<SetStateAction<IndicatorState>>;
}

interface ParamInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  width?: string;
}

function ParamInput({ value, onChange, min = 1, max = 500, width = "w-12" }: ParamInputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className={`${width} h-6 text-xs text-center bg-bg border border-border rounded text-text-1 outline-none focus:border-accent font-data`}
    />
  );
}

interface IndicatorRowProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  children?: React.ReactNode;
}

function IndicatorRow({ checked, onToggle, label, children }: IndicatorRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-3.5 h-3.5 accent-accent cursor-pointer"
      />
      <span className={`text-xs w-24 shrink-0 ${checked ? "text-accent" : "text-text-2 group-hover:text-text-1"}`}>
        {label}
      </span>
      {children && <div className="flex items-center gap-1.5 flex-wrap">{children}</div>}
    </label>
  );
}

export function IndicatorTab({ indicators: ind, setIndicators }: IndicatorTabProps) {
  // 특정 지표 필드 부분 갱신 (불변)
  function patch<K extends IndicatorKey>(key: K, partial: Partial<IndicatorState[K]>) {
    setIndicators(prev => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  }
  function toggle(key: IndicatorKey) {
    setIndicators(prev => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }));
  }

  const count = activeIndicatorCount(ind);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-3">
          {count > 0 ? `${count}개 활성` : "지표를 켜면 차트에 표시됩니다"}
        </span>
        {count > 0 && (
          <button
            onClick={() => setIndicators(DEFAULT_INDICATORS)}
            className="px-2 py-1 text-xs rounded border border-border text-text-3 hover:border-neg hover:text-neg bg-transparent cursor-pointer transition-colors"
          >
            모두 끄기
          </button>
        )}
      </div>

      {/* 오버레이 */}
      <div>
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">오버레이</p>
        <div className="flex flex-col gap-2">
          <IndicatorRow checked={ind.sma.on} onToggle={() => toggle("sma")} label="SMA">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.sma.period} onChange={v => patch("sma", { period: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.ema.on} onToggle={() => toggle("ema")} label="EMA">
            <span className="text-text-3 text-xs">fast:</span>
            <ParamInput value={ind.ema.fast} onChange={v => patch("ema", { fast: v })} />
            <span className="text-text-3 text-xs">slow:</span>
            <ParamInput value={ind.ema.slow} onChange={v => patch("ema", { slow: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.bb.on} onToggle={() => toggle("bb")} label="볼린저밴드">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.bb.period} onChange={v => patch("bb", { period: v })} />
            <span className="text-text-3 text-xs">std:</span>
            <ParamInput value={ind.bb.std} onChange={v => patch("bb", { std: v })} min={1} max={10} />
          </IndicatorRow>
        </div>
      </div>

      {/* 오실레이터 */}
      <div>
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">오실레이터</p>
        <div className="flex flex-col gap-2">
          <IndicatorRow checked={ind.rsi.on} onToggle={() => toggle("rsi")} label="RSI">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.rsi.period} onChange={v => patch("rsi", { period: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.macd.on} onToggle={() => toggle("macd")} label="MACD">
            <span className="text-text-3 text-xs">fast:</span>
            <ParamInput value={ind.macd.fast} onChange={v => patch("macd", { fast: v })} />
            <span className="text-text-3 text-xs">slow:</span>
            <ParamInput value={ind.macd.slow} onChange={v => patch("macd", { slow: v })} />
            <span className="text-text-3 text-xs">sig:</span>
            <ParamInput value={ind.macd.signal} onChange={v => patch("macd", { signal: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.stoch.on} onToggle={() => toggle("stoch")} label="스토캐스틱">
            <span className="text-text-3 text-xs">%K:</span>
            <ParamInput value={ind.stoch.k} onChange={v => patch("stoch", { k: v })} />
            <span className="text-text-3 text-xs">%D:</span>
            <ParamInput value={ind.stoch.d} onChange={v => patch("stoch", { d: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.cci.on} onToggle={() => toggle("cci")} label="CCI">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.cci.period} onChange={v => patch("cci", { period: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.wr.on} onToggle={() => toggle("wr")} label="Williams %R">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.wr.period} onChange={v => patch("wr", { period: v })} />
          </IndicatorRow>
        </div>
      </div>

      {/* 추세 / 변동성 */}
      <div>
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">추세 / 변동성</p>
        <div className="flex flex-col gap-2">
          <IndicatorRow checked={ind.adx.on} onToggle={() => toggle("adx")} label="ADX">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.adx.period} onChange={v => patch("adx", { period: v })} />
          </IndicatorRow>
          <IndicatorRow checked={ind.atr.on} onToggle={() => toggle("atr")} label="ATR">
            <span className="text-text-3 text-xs">period:</span>
            <ParamInput value={ind.atr.period} onChange={v => patch("atr", { period: v })} />
          </IndicatorRow>
        </div>
      </div>

      {/* 거래량 */}
      <div>
        <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">거래량</p>
        <div className="flex flex-col gap-2">
          <IndicatorRow checked={ind.volume.on} onToggle={() => toggle("volume")} label="거래량" />
          <IndicatorRow checked={ind.obv.on} onToggle={() => toggle("obv")} label="OBV" />
        </div>
      </div>
    </div>
  );
}
