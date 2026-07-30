// 터미널 디자인 시스템 공용 토큰/포맷터. components/console/primitives.tsx 의 TONE 패턴과
// 동일한 규약(--c-* CSS 변수 참조)을 따르되, 이 폴더 전용으로 격리해 기존 콘솔 킷을 건드리지 않음.

export type Tone = "pos" | "neg" | "warn" | "hud" | "info" | "mute";

export const TONE_COLOR: Record<Tone, string> = {
  pos: "var(--c-pos)",
  neg: "var(--c-neg)",
  warn: "var(--c-warn)",
  hud: "var(--c-hud)",
  info: "var(--c-info)",
  mute: "var(--c-text-3)",
};

export function toneColor(tone: Tone | string): string {
  return TONE_COLOR[tone as Tone] ?? tone;
}

// 부호 기반 자동 톤 (수익률/손익 등) — 0은 mute 처리
export function signTone(value: number): Tone {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "mute";
}

export type NumberFormat = "percent" | "currency" | "ratio" | "number" | "raw";

export function formatValue(value: number | string, format: NumberFormat = "raw", precision = 2): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "percent":
      return `${value >= 0 ? "+" : ""}${value.toFixed(precision)}%`;
    case "currency":
      // 로케일을 고정(en-US)해 브라우저 설정에 따라 천단위/소수점 구분자가
      // 바뀌지 않게 함 — 금융 수치에서 "," vs "." 혼동은 오독 리스크가 큼.
      return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}`;
    case "ratio":
      return value.toFixed(precision);
    case "number":
      return value.toLocaleString("en-US", { maximumFractionDigits: precision });
    default:
      return String(value);
  }
}

export function formatRelativeTime(ts: string | number | Date): string {
  const t = ts instanceof Date ? ts.getTime() : typeof ts === "number" ? ts : new Date(ts).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
