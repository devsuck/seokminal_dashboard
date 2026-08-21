/** 0~1 비율 막대. `style={{}}` 금지 규칙 때문에 10% 단위 정적 클래스로 양자화. */
const W = [
  "w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]",
  "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full",
];

export function Bar({ ratio, tone = "bg-accent", width = "w-10" }: {
  ratio: number;
  /** 채움 색 클래스 */
  tone?: string;
  /** 트랙 폭 클래스 */
  width?: string;
}) {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return (
    <span className={`inline-block ${width} h-1 bg-panel-2 border border-border shrink-0 align-middle`}>
      <span className={`block h-full ${tone} ${W[Math.round(r * 10)]}`} />
    </span>
  );
}
