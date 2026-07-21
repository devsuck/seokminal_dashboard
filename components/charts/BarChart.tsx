import { TOKEN } from "@/lib/chart-colors";

export interface BarItem {
  label: string;
  value: number;
  color?: string;   // 기본: 극성(pos/neg)
  href?: string;
  sub?: string;     // 우측 보조 텍스트(예: 거래량)
}

/** 수평 막대(SVG/HTML). 크기(magnitude)·랭킹용. 값 최대치 기준 폭, 막대별 툴팁,
 *  4px 라운드 데이터엔드, 라벨은 text 토큰(막대만 색). one-axis. */
export function BarChart({ items, valueFmt = (v) => v.toLocaleString(), barH = 18 }: {
  items: BarItem[];
  valueFmt?: (v: number) => string;
  barH?: number;
}) {
  const max = Math.max(1, ...items.map((it) => Math.abs(it.value)));
  return (
    <div className="space-y-1">
      {items.map((it, i) => {
        const pct = (Math.abs(it.value) / max) * 100;
        const color = it.color ?? (it.value >= 0 ? TOKEN.pos : TOKEN.neg);
        const labelEl = it.href
          ? <a href={it.href} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">{it.label}</a>
          : <span className="text-text-2">{it.label}</span>;
        return (
          <div key={`${it.label}-${i}`} className="flex items-center gap-2 text-[11px] font-data" title={`${it.label}: ${valueFmt(it.value)}${it.sub ? " · " + it.sub : ""}`}>
            <span className="w-28 shrink-0 truncate">{labelEl}</span>
            <div className="flex-1 min-w-0">
              <svg width="100%" height={barH} viewBox={`0 0 100 ${barH}`} preserveAspectRatio="none" role="img">
                <rect x={0} y={barH / 2 - 1} width={100} height={2} fill={TOKEN.border} />
                <rect x={0} y={2} width={pct} height={barH - 4} rx={1.5} fill={color} />
              </svg>
            </div>
            <span className={`w-20 shrink-0 text-right tabular-nums ${it.value >= 0 ? "text-pos" : "text-neg"}`}>{valueFmt(it.value)}</span>
            {it.sub && <span className="w-16 shrink-0 text-right text-text-3 tabular-nums">{it.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}
