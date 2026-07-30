"use client";

import {
  INDICATORS, OPS, MA_TYPES, BB_BANDS,
  defaultInd,
  type IndicatorOp, type CompRow, type IndicatorType, type MAType, type BBBand, type CompOp,
} from "@/lib/backtest-types";

// ── Internal: indicator select ─────────────────────────────────────
function IndSelect({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  return (
    <select
      className="compact"value={op.indicator}
      onChange={e => onChange(defaultInd(e.target.value as IndicatorType))}
    >
      {INDICATORS.map(i => <option key={i}>{i}</option>)}
    </select>
  );
}

// ── Internal: indicator params ─────────────────────────────────────
function IndParams({ op, onChange }: { op: IndicatorOp; onChange: (o: IndicatorOp) => void }) {
  const upd = (patch: Partial<IndicatorOp>) => onChange({ ...op, ...patch });
  return (
    <span className="inline-flex gap-1.5 items-center">
      {["RSI", "MA", "BB", "CCI"].includes(op.indicator) && (
        <>
          <span className="text-text-3 text-[10px]">P</span>
          <input type="number" value={op.period} min={1} className="compact w-12"onChange={e => upd({ period: Number(e.target.value) })} />
        </>
      )}
      {["MA", "BB"].includes(op.indicator) && (
        <select className="compact" value={op.ma_type}
          onChange={e => upd({ ma_type: e.target.value as MAType })}>
          <option value="SIMPLE">SMA</option>
          <option value="EXPONENTIAL">EMA</option>
          <option value="WEIGHTED">WMA</option>
        </select>
      )}
      {op.indicator === "BB" && (
        <>
          <span className="text-text-3 text-[10px]">K</span>
          <input type="number" value={op.k} step={0.1} min={0.1} className="compact w-12"onChange={e => upd({ k: Number(e.target.value) })} />
          <select className="compact" value={op.band}
            onChange={e => upd({ band: e.target.value as BBBand })}>
            {BB_BANDS.map(b => (
              <option key={b} value={b}>
                {b === "upper" ? "↑ 상단" : b === "middle" ? "─ 중간" : "↓ 하단"}
              </option>
            ))}
          </select>
        </>
      )}
      {op.indicator === "MACD" && (
        <>
          <span className="text-text-3 text-[10px]">F</span>
          <input type="number" value={op.fast_period} min={1} className="compact w-12"onChange={e => upd({ fast_period: Number(e.target.value) })} />
          <span className="text-text-3 text-[10px]">S</span>
          <input type="number" value={op.slow_period} min={1} className="compact w-12"onChange={e => upd({ slow_period: Number(e.target.value) })} />
        </>
      )}
    </span>
  );
}

// ── Public: ConditionRow ───────────────────────────────────────────
interface ConditionRowProps {
  row: CompRow;
  onChange: (r: CompRow) => void;
  onRemove: () => void;
  isOnly: boolean;
}

export function ConditionRow({ row, onChange, onRemove, isOnly }: ConditionRowProps) {
  const upd = (patch: Partial<CompRow>) => onChange({ ...row, ...patch });
  return (
    <div className="flex flex-wrap gap-2 items-center py-2 border-b border-border/50 last:border-0 group">
      {/* Left operand */}
      <IndSelect op={row.left} onChange={left => upd({ left })} />
      <IndParams op={row.left} onChange={left => upd({ left })} />

      {/* Operator */}
      <select className="compact w-14" value={row.op}
        onChange={e => upd({ op: e.target.value as CompOp })}>
        {OPS.map(o => <option key={o}>{o}</option>)}
      </select>

      {/* Right type toggle */}
      <select className="compact" value={row.rightType}
        onChange={e => upd({ rightType: e.target.value as "literal" | "indicator" })}>
        <option value="literal">값</option>
        <option value="indicator">지표</option>
      </select>

      {/* Right operand */}
      {row.rightType === "literal" ? (
        <input type="number" value={row.rightLiteral} className="compact w-16"onChange={e => upd({ rightLiteral: Number(e.target.value) })} />
      ) : (
        <>
          <IndSelect op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
          <IndParams op={row.rightIndicator} onChange={rightIndicator => upd({ rightIndicator })} />
        </>
      )}

      {/* Remove button */}
      {!isOnly && (
        <button
          onClick={onRemove}
          className="ml-auto opacity-0 group-hover:opacity-100 text-text-3 hover:text-neg text-base leading-none cursor-pointer bg-transparent border-0 px-1 transition-all"aria-label="조건 삭제">
          ×
        </button>
      )}
    </div>
  );
}
