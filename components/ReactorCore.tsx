"use client";

import { useEffect, useRef } from "react";

/* ReactorCore — 캔버스 파티클 구체 (Jarvis 아크리액터).
   수백 개 글로우 입자를 피보나치 구면 + 궤도 링에 배치 → Y축 회전 3D 투영.
   additive 합성('lighter')으로 블룸. 6색 레벨 variant. */

export type OrbVariant = "amber" | "green" | "blue" | "yellow" | "orange" | "red" | "pink";

interface P { x: number; y: number; z: number; s: number; ring: boolean; }

function buildPoints(nShell: number, rings: { count: number; tilt: number; roll: number }[]): P[] {
  const pts: P[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nShell; i++) {
    const y = 1 - (i / (nShell - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = i * golden;
    pts.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r, s: 0.6 + Math.random() * 0.9, ring: false });
  }
  for (const rg of rings) {
    for (let i = 0; i < rg.count; i++) {
      const a = (i / rg.count) * Math.PI * 2;
      let x = Math.cos(a), y = 0, z = Math.sin(a);
      const ty = y * Math.cos(rg.tilt) - z * Math.sin(rg.tilt);
      const tz = y * Math.sin(rg.tilt) + z * Math.cos(rg.tilt);
      y = ty; z = tz;
      const rx = x * Math.cos(rg.roll) - y * Math.sin(rg.roll);
      const ry = x * Math.sin(rg.roll) + y * Math.cos(rg.roll);
      x = rx; y = ry;
      pts.push({ x, y, z, s: 1.0 + Math.random() * 1.2, ring: true });
    }
  }
  return pts;
}

// 레벨별 색상 파라미터 [coreR,coreG,coreB / particleR(fn), particleG(fn), particleB(fn)]
const VARIANT_CORE: Record<OrbVariant, [string, string, string]> = {
  amber:  ["rgba(255,238,190,0.9)",  "rgba(255,160,30,0.35)",  "rgba(255,120,0,0)"],
  green:  ["rgba(180,255,190,0.92)", "rgba(30,220,80,0.38)",   "rgba(0,180,40,0)"],
  blue:   ["rgba(180,210,255,0.92)", "rgba(50,130,255,0.38)",  "rgba(0,80,220,0)"],
  yellow: ["rgba(255,255,180,0.92)", "rgba(240,210,20,0.40)",  "rgba(200,160,0,0)"],
  orange: ["rgba(255,210,160,0.92)", "rgba(255,130,20,0.40)",  "rgba(220,80,0,0)"],
  red:    ["rgba(255,200,200,0.95)", "rgba(255,40,40,0.40)",   "rgba(200,0,0,0)"],
  pink:   ["rgba(255,180,240,0.95)", "rgba(240,50,180,0.40)",  "rgba(200,0,150,0)"],
};

function particleRGB(v: OrbVariant, depth: number): [number, number, number] {
  switch (v) {
    case "green":  return [Math.round(80 + depth * 100),  255,                       Math.round(80 + depth * 60)];
    case "blue":   return [Math.round(80 + depth * 100),  Math.round(120 + depth * 80), 255];
    case "yellow": return [255,                            Math.round(200 + depth * 55), Math.round(0 + depth * 40)];
    case "orange": return [255,                            Math.round(100 + depth * 110), Math.round(10 + depth * 40)];
    case "red":    return [255,                            Math.round(60 + depth * 120), Math.round(60 + depth * 80)];
    case "pink":   return [255,                            Math.round(60 + depth * 100), Math.round(180 + depth * 60)];
    default:       return [255,                            Math.round(150 + depth * 105), Math.round(30 + depth * 120)]; // amber
  }
}

const GLOW_CLS: Record<OrbVariant, string> = {
  amber:  "amber-glow-lg",
  green:  "green-glow-lg",
  blue:   "blue-glow-lg",
  yellow: "yellow-glow-lg",
  orange: "orange-glow-lg",
  red:    "red-glow-lg",
  pink:   "pink-glow-lg",
};

export function ReactorCore({ size = 160, active = true, variant = "amber" }: {
  size?: number; active?: boolean; variant?: OrbVariant;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const pts = buildPoints(460, [
      { count: 120, tilt: 1.15, roll: 0.2 },
      { count: 110, tilt: 0.5, roll: 1.3 },
      { count: 90, tilt: 1.5, roll: 2.4 },
    ]);
    const cx = size / 2, cy = size / 2;
    const R = size * 0.42;
    const focal = 3.2;
    let angle = 0;
    const ax = 0.34;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const cosX = Math.cos(ax), sinX = Math.sin(ax);

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
      if (active) {
        const [c0, c1, c2] = VARIANT_CORE[variant];
        core.addColorStop(0, c0);
        core.addColorStop(0.4, c1);
        core.addColorStop(1, c2);
      } else {
        core.addColorStop(0, "rgba(160,180,200,0.18)");
        core.addColorStop(0.4, "rgba(100,130,160,0.08)");
        core.addColorStop(1, "rgba(80,110,140,0)");
      }
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2); ctx.fill();

      for (const p of pts) {
        let x = p.x * cosA - p.z * sinA;
        let z = p.x * sinA + p.z * cosA;
        let y = p.y;
        const y2 = y * cosX - z * sinX;
        const z2 = y * sinX + z * cosX;
        y = y2; z = z2;
        const persp = focal / (focal - z);
        const sx = cx + x * R * persp;
        const sy = cy + y * R * persp;
        const depth = (z + 1) / 2;
        if (active) {
          const alpha = (p.ring ? 0.5 : 0.28) + depth * (p.ring ? 0.5 : 0.5);
          const rad = p.s * persp * (p.ring ? 0.9 : 0.7);
          const [r, g, b] = particleRGB(variant, depth);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.4, rad), 0, Math.PI * 2); ctx.fill();
        } else {
          const alpha = (p.ring ? 0.12 : 0.07) + depth * 0.1;
          const rad = p.s * persp * (p.ring ? 0.7 : 0.5);
          const rv = Math.round(110 + depth * 40);
          const gv = Math.round(130 + depth * 40);
          const bv = Math.round(160 + depth * 40);
          ctx.fillStyle = `rgba(${rv},${gv},${bv},${alpha})`;
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.3, rad), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      angle += active ? 0.011 : 0.0008;
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [size, active, variant]);

  return <canvas ref={ref} className={`block ${GLOW_CLS[variant]} ${BOX[size] ?? BOX[160]}`} aria-hidden />;
}

const BOX: Record<number, string> = {
  84: "w-[84px] h-[84px]", 100: "w-[100px] h-[100px]", 120: "w-[120px] h-[120px]",
  132: "w-[132px] h-[132px]", 160: "w-[160px] h-[160px]", 200: "w-[200px] h-[200px]",
};

export function lvToOrbVariant(lv: number): OrbVariant {
  const map: Record<number, OrbVariant> = { 1: "green", 2: "blue", 3: "yellow", 4: "orange", 5: "red", 6: "pink" };
  return map[lv] ?? "amber";
}
