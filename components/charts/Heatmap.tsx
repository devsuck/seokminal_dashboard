import { TOKEN } from "@/lib/chart-colors";

export interface HeatCell {
  value: number | null;   // null = 데이터 없음/BLOCKED
  tooltip: string;        // 마크별 호버(정확한 수치는 여기 + 병존 테이블)
  blocked?: boolean;
}

/**
 * group×column 히트맵(SVG). 셀 색만으로 패턴 전달(정확한 수치는 툴팁+병존 테이블 —
 * dataviz: 셀 텍스트는 배경 대비 문제라 생략). one-axis, 마크별 호버.
 */
export function Heatmap({
  rows, cols, cellOf, colorOf, cell = 40, rowLabelW = 96, colLabelH = 20,
}: {
  rows: string[];
  cols: string[];
  cellOf: (row: string, col: string) => HeatCell;
  colorOf: (value: number) => string;
  cell?: number;
  rowLabelW?: number;
  colLabelH?: number;
}) {
  const gap = 2;
  const w = rowLabelW + cols.length * cell;
  const h = colLabelH + rows.length * cell;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="heatmap" className="font-data max-w-full">
      {cols.map((c, ci) => (
        <text key={c} x={rowLabelW + ci * cell + cell / 2} y={colLabelH - 7}
          textAnchor="middle" fontSize="10" fill={TOKEN.text3}>{c}</text>
      ))}
      {rows.map((r, ri) => (
        <g key={r}>
          <text x={rowLabelW - 6} y={colLabelH + ri * cell + cell / 2}
            textAnchor="end" dominantBaseline="middle" fontSize="10" fill={TOKEN.text2}>{r}</text>
          {cols.map((c, ci) => {
            const d = cellOf(r, c);
            const x = rowLabelW + ci * cell + gap / 2;
            const y = colLabelH + ri * cell + gap / 2;
            const s = cell - gap;
            const empty = d.blocked || d.value == null;
            return (
              <rect key={c} x={x} y={y} width={s} height={s}
                fill={empty ? TOKEN.panel2 : colorOf(d.value as number)}
                stroke={empty ? TOKEN.border : "none"} strokeWidth={empty ? 1 : 0}>
                <title>{d.tooltip}</title>
              </rect>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
