import { TOKEN } from "@/lib/chart-colors";

/**
 * 실제값이 방향-셔플 null(500회) 대비 어디에 위치하는지 — percentile(0~100) strip.
 * 상위 유의영역(≥sigPct) 음영 + 실제값 마커. p<0.05면 accent 강조.
 * NOTE: 전체 null 히스토그램(분포 모양)은 백엔드 null 분위수가 필요 — C1 범위 밖.
 * 여기선 이미 계산된 percentile/p_value만 소비(스펙 §5 준수).
 */
export function NullDistribution({
  percentile, pValue, width = 150, height = 12, sigPct = 95,
}: {
  percentile: number;
  pValue: number;
  width?: number;
  height?: number;
  sigPct?: number;
}) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percentile) ? percentile : 0));
  const sig = pValue < 0.05;
  const x = (p / 100) * width;
  const sigX = (sigPct / 100) * width;
  const cy = height / 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`percentile ${p.toFixed(0)}, p ${pValue.toFixed(4)}`} className="max-w-full">
      <title>{`percentile ${p.toFixed(0)} · p=${pValue.toFixed(4)}${sig ? " · 유의(<0.05)" : ""}`}</title>
      {/* 유의 tail 음영(≥sigPct) */}
      <rect x={sigX} y={0} width={Math.max(0, width - sigX)} height={height} fill={TOKEN.accent} opacity={0.12} />
      {/* null 축 0~100 */}
      <rect x={0} y={cy - 1} width={width} height={2} fill={TOKEN.border} />
      {/* 실제값 마커 */}
      <circle cx={x} cy={cy} r={3.5} fill={sig ? TOKEN.accent : TOKEN.text2} />
    </svg>
  );
}
