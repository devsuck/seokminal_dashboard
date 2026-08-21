/**
 * 인라인 SVG 스파크라인 — 축·툴팁 없이 "추세만" 보여주는 최소 단위.
 * 축과 값 읽기가 필요하면 TimeSeries(lightweight-charts)를 쓸 것.
 * invert: 값이 작을수록 좋은 지표(p-value 등)를 위로 그림.
 */
export function Sparkline({
  values, w = 88, h = 24, stroke = "var(--color-text-3)", invert = false, stretch = false, label,
}: {
  values: number[];
  w?: number;
  h?: number;
  stroke?: string;
  invert?: boolean;
  /** 컨테이너 폭에 맞춰 늘림. w/h는 viewBox 좌표계로만 쓰임. */
  stretch?: boolean;
  label?: string;
}) {
  if (values.length < 2) return <span className="text-text-3 text-xs">—</span>;
  const pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (values.length - 1);
    const t = (v - min) / span;
    const y = pad + (invert ? t : 1 - t) * (h - 2 * pad);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const size = stretch
    ? { width: "100%", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none" as const }
    : { width: w };
  return (
    <svg {...size} height={h} className={stretch ? "" : "overflow-visible shrink-0"} role="img" aria-label={label ?? "추세"}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
