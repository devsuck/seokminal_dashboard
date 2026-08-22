/** 0~1 비율 막대. `style={{}}` 금지 규칙 때문에 10% 단위 정적 클래스로 양자화. */
const W = [
  "w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]",
  "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full",
];

export function Bar({ ratio, tone = "bg-accent", width = "w-10", trackClass = "bg-panel-2 border-border" }: {
  ratio: number;
  /** 채움 색 클래스 */
  tone?: string;
  /** 트랙 폭 클래스 */
  width?: string;
  /** 트랙 배경/테두리 클래스 (e.g. ap- light-theme routes) */
  trackClass?: string;
}) {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return (
    <span className={`inline-block ${width} h-1 border shrink-0 align-middle ${trackClass}`}>
      <span className={`block h-full ${tone} ${W[Math.round(r * 10)]}`} />
    </span>
  );
}
