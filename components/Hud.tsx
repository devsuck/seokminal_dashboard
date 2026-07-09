"use client";

/* Hud — Jarvis 스타일 상태 리드아웃(테두리 박스 + 회전 타겟팅 링 + LED) / 방사 게이지.
   구 ArcReactor는 캔버스 파티클 오브(ReactorCore)를 썼으나 블룸버그 순흑/각짐 톤과 안 어울려 제거.
   지금은 SVG 링 + font-data 텍스트만(오브 없음), 색은 디자인 토큰만 사용. */

export type HudTone = "accent" | "pos" | "info" | "neg";

const TONE_VAR: Record<HudTone, string> = {
  accent: "var(--color-accent)", pos: "var(--color-pos)", info: "var(--color-info)", neg: "var(--color-neg)",
};
const TONE_TEXT: Record<HudTone, string> = {
  accent: "text-accent", pos: "text-pos", info: "text-info", neg: "text-neg",
};
const TONE_TEXT_DIM: Record<HudTone, string> = {
  accent: "text-accent/60", pos: "text-pos/60", info: "text-info/60", neg: "text-neg/60",
};
const TONE_BORDER: Record<HudTone, string> = {
  accent: "border-accent/35", pos: "border-pos/35", info: "border-info/35", neg: "border-neg/35",
};
const TONE_DOT: Record<HudTone, string> = {
  accent: "bg-accent amber-glow", pos: "bg-pos green-glow", info: "bg-info blue-glow", neg: "bg-neg red-glow",
};

// 방사 틱 마크 좌표 생성(게이지용).
// 좌표는 3자리 반올림 — 풀정밀 float은 SSR/클라이언트 마지막 자리 차이로 hydration mismatch 발생.
function ticks(cx: number, cy: number, rIn: number, rOut: number, n: number) {
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(a), s = Math.sin(a);
    return { x1: r3(cx + c * rIn), y1: r3(cy + s * rIn), x2: r3(cx + c * rOut), y2: r3(cy + s * rOut), k: i };
  });
}

/* ── 상태 리드아웃 박스(테두리 + 회전 타겟팅 링 + LED, 톤별 색상) ────── */
export function ArcReactor({ size = 132, active = true, label, sub, tone = "accent" }:
  { size?: number; active?: boolean; label?: string; sub?: string; tone?: HudTone }) {
  const box = SIZE[size] ?? SIZE[132];
  const col = active ? TONE_VAR[tone] : "var(--color-text-3)";
  return (
    <div className={`relative ${box} shrink-0 flex items-center justify-center border bg-panel-2 ${active ? TONE_BORDER[tone] : "border-border"}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke={col} strokeOpacity={active ? 0.3 : 0.15}
          strokeWidth="0.5" strokeDasharray="1 4" className={active ? "spin-cw-slow" : ""} />
        <circle cx="50" cy="50" r="40" fill="none" stroke={col} strokeOpacity={active ? 0.6 : 0.2}
          strokeWidth="0.8" strokeDasharray="22 90" strokeLinecap="round" className={active ? "spin-ccw" : ""} />
      </svg>
      {active && <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse ${TONE_DOT[tone]}`} />}
      {(label || sub) && (
        <div className="flex flex-col items-center pointer-events-none">
          {label && <span className={`font-data text-sm font-bold leading-none ${active ? TONE_TEXT[tone] : "text-text-3"}`}>{label}</span>}
          {sub && <span className={`font-data text-[7px] uppercase tracking-widest mt-1 ${active ? TONE_TEXT_DIM[tone] : "text-text-3"}`}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ── 방사 게이지(값 링) ────────────────────────────────────────────── */
export function RadialGauge({ size = 84, pct, value, label, tone = "hud" }:
  { size?: number; pct: number; value: string; label: string; tone?: "hud" | "pos" | "neg" | "accent" }) {
  const box = SIZE[size] ?? SIZE[84];
  const p = Math.max(0, Math.min(100, pct));
  const r = 40, circ = 2 * Math.PI * r, dash = (p / 100) * circ;
  const col = tone === "pos" ? "var(--color-pos)" : tone === "neg" ? "var(--color-neg)"
    : tone === "accent" ? "var(--color-accent)" : "var(--color-hud)";
  return (
    <div className={`relative ${box} shrink-0`}>
      <svg viewBox="0 0 100 100" className="w-full h-full hud-glow" aria-hidden>
        <g stroke={col} strokeOpacity="0.3" strokeWidth="0.7">
          {ticks(50, 50, 44, 48, 36).map(t => <line key={t.k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />)}
        </g>
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeOpacity="0.15" strokeWidth="4" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`font-data text-sm font-bold ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "accent" ? "text-accent" : "text-hud"}`}>{value}</span>
        <span className="font-data text-[8px] uppercase tracking-wider text-text-3 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

const SIZE: Record<number, string> = {
  60: "w-[60px] h-[60px]", 72: "w-[72px] h-[72px]", 84: "w-[84px] h-[84px]",
  100: "w-[100px] h-[100px]", 132: "w-[132px] h-[132px]", 160: "w-[160px] h-[160px]",
};
