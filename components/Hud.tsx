"use client";

import { ReactorCore } from "@/components/ReactorCore";

/* Hud — Iron-Man/Jarvis HUD. 중심 오브 = 캔버스 파티클 구체(ReactorCore),
   주변 = SVG 링/게이지. 게이지 색은 시안(--color-hud), 오브는 앰버. */

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

/* ── 아크리액터 중심 오브 (캔버스 파티클 구체 + HUD 링) ─────────────── */
export function ArcReactor({ size = 132, active = true, label, sub }:
  { size?: number; active?: boolean; label?: string; sub?: string }) {
  const box = SIZE[size] ?? SIZE[132];
  return (
    <div className={`relative ${box} shrink-0 flex items-center justify-center`}>
      {/* 캔버스 파티클 구체 = 진짜 부피감 */}
      <ReactorCore size={size} active={active} />
      {/* 얇은 HUD 링 오버레이(타겟팅 프레임) */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--color-accent)" strokeOpacity="0.22"
          strokeWidth="0.5" strokeDasharray="1 4" className={active ? "spin-cw-slow" : ""} />
        <circle cx="50" cy="50" r="43" fill="none" stroke="var(--color-accent)" strokeOpacity="0.5"
          strokeWidth="0.7" strokeDasharray="24 90" strokeLinecap="round" className={active ? "spin-ccw" : ""} />
      </svg>
      {(label || sub) && (
        <div className="absolute left-0 right-0 bottom-1 flex flex-col items-center pointer-events-none">
          {label && <span className="font-data text-[11px] font-bold text-accent leading-none drop-shadow">{label}</span>}
          {sub && <span className="font-data text-[7px] uppercase tracking-widest text-accent/60 mt-0.5">{sub}</span>}
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
