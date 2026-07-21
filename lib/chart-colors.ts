// 차트 색상 상수 — app/globals.css의 디자인 토큰과 반드시 일치시킬 것.
// D3/SVG 등 CSS 변수를 못 쓰고 리터럴 hex가 필요한 곳에서 이 상수를 씀.

export const TOKEN = {
  bg: "#000000",
  panel: "#020202",
  panel2: "#0A0A0A",
  border: "#2A2A2A",
  text1: "#F2F2F2",
  text2: "#A8A8A8",
  text3: "#6B6B6B",
  accent: "#FF9F0A",
  hud: "#22D3EE",
  pos: "#00D964",
  neg: "#FF3B30",
  warn: "#FFD60A",
  info: "#3B9CFF",
} as const;

// 멀티시리즈 차트(종목/지표 N개 구분용) — 토큰 색(accent/pos/neg/warn/info/hud)과
// 겹치지 않는 8색 순환 팔레트. 의미(양/음/경고)를 갖지 않는 순수 구분용 색만 여기 추가할 것.
export const CATEGORICAL = [
  "#A855F7", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#3B82F6", // blue
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#818CF8", // indigo
] as const;

export function categoricalColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}

// sequential 램프(매그니튜드 인코딩) — 시안 단일 hue. 순흑 배경이라 dim→bright
// (강할수록 밝게 튐). globals.css --color-seq-1..4와 일치. 리터럴 hex.
export const SEQ = ["#164E63", "#0E7490", "#22D3EE", "#A5F3FC"] as const;

// t in [0,1] (0=약함 → 1=강함) → SEQ 4스텝 이산 색(t=1이 가장 밝음).
export function seqColor(t: number): string {
  const c = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return SEQ[Math.min(SEQ.length - 1, Math.floor(c * SEQ.length))];
}
