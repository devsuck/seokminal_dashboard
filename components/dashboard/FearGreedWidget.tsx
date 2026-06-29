"use client";

import { useEffect, useState } from "react";
import { getFearGreed, type FearGreedResponse } from "@/lib/api";

const ZONES = [
  { label: "Extreme Fear",  min: 0,  max: 24, color: "text-neg",  bg: "bg-neg/10"  },
  { label: "Fear",          min: 25, max: 44, color: "text-warn", bg: "bg-warn/10" },
  { label: "Neutral",       min: 45, max: 55, color: "text-text-2", bg: "bg-panel-2" },
  { label: "Greed",         min: 56, max: 74, color: "text-pos",  bg: "bg-pos/10"  },
  { label: "Extreme Greed", min: 75, max: 100, color: "text-pos", bg: "bg-pos/15"  },
] as const;

function zone(v: number) {
  return ZONES.find(z => v >= z.min && v <= z.max) ?? ZONES[2];
}

function Arc({ value }: { value: number }) {
  const r = 42;
  const cx = 60, cy = 60;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const pct = value / 100;
  const angle = startAngle + pct * Math.PI;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillEnd = angle > Math.PI ? 1 : 0;
  const fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${fillEnd} 1 ${x} ${y}`;

  const z = zone(value);
  const strokeColor =
    z.label.includes("Fear") ? "#ef4444" :
    z.label === "Neutral"    ? "#6b7280" :
    "#22c55e";

  return (
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d={trackPath} fill="none" stroke="var(--color-border, #1f2937)" strokeWidth="8" strokeLinecap="round" />
      {value > 0 && (
        <path d={fillPath} fill="none" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
      )}
      <circle cx={x} cy={y} r={4} fill={strokeColor} />
    </svg>
  );
}

export function FearGreedWidget() {
  const [data, setData] = useState<FearGreedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFearGreed()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const z = data ? zone(data.value) : null;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 flex flex-col items-center justify-center gap-1">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold w-full">
        Fear & Greed
      </span>

      {loading ? (
        <div className="h-16 flex items-center justify-center text-text-3 text-xs">Loading…</div>
      ) : !data ? (
        <div className="h-16 flex items-center justify-center text-text-3 text-xs">—</div>
      ) : (
        <>
          <Arc value={data.value} />
          <span className={`text-2xl font-data font-bold ${z?.color}`}>{data.value}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${z?.bg} ${z?.color}`}>
            {data.classification}
          </span>
          <span className="text-text-3 text-[9px] mt-0.5">Crypto Market</span>
        </>
      )}
    </div>
  );
}
