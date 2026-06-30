"use client";

import { useEffect, useState } from "react";
import { getFGMarkets, type FGMarketsResponse } from "@/lib/api";

const ZONES = [
  { label: "Extreme Fear",  min: 0,  max: 24, color: "#ef4444" },
  { label: "Fear",          min: 25, max: 44, color: "#f59e0b" },
  { label: "Neutral",       min: 45, max: 55, color: "#6b7280" },
  { label: "Greed",         min: 56, max: 74, color: "#22c55e" },
  { label: "Extreme Greed", min: 75, max: 100, color: "#16a34a" },
];

function zoneColor(v: number) {
  return ZONES.find(z => v >= z.min && v <= z.max)?.color ?? "#6b7280";
}

function zoneLabel(cls: string) {
  return cls;
}

function MiniArc({ value, color }: { value: number; color: string }) {
  const r = 28, cx = 36, cy = 36;
  const circ = Math.PI * r;
  const pct = value / 100;
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const angle = Math.PI + pct * Math.PI;
  const nx = cx + r * Math.cos(angle);
  const ny = cy + r * Math.sin(angle);
  const fill = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`;

  return (
    <svg width="72" height="44" viewBox="0 0 72 44" className="overflow-visible">
      <path d={track} fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
      {value > 0 && (
        <path d={fill} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}55)` }} />
      )}
      <circle cx={nx} cy={ny} r={3.5} fill={color} />
      <text x="36" y="38" textAnchor="middle" fill={color} fontSize="11"
        fontFamily="'IBM Plex Mono', monospace" fontWeight="700">{value}</text>
    </svg>
  );
}

function MarketGauge({ label, market, note }: {
  label: string;
  market: { value: number; classification: string } | null;
  note?: string;
}) {
  const color = market ? zoneColor(market.value) : "#6b7280";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">{label}</span>
      {market ? (
        <>
          <MiniArc value={market.value} color={color} />
          <span className="text-[10px] font-medium" style={{ color }}>{zoneLabel(market.classification)}</span>
          {note && <span className="text-[9px] text-text-3 italic">{note}</span>}
        </>
      ) : (
        <div className="h-10 flex items-center justify-center text-text-3 text-xs">—</div>
      )}
    </div>
  );
}

export function FearGreedWidget() {
  const [data, setData] = useState<FGMarketsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFGMarkets()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-3">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">Fear & Greed</span>

      {loading ? (
        <div className="flex items-center justify-center h-20 text-text-3 text-xs">Loading…</div>
      ) : !data ? (
        <div className="flex items-center justify-center h-20 text-text-3 text-xs">—</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 divide-x divide-border">
          <MarketGauge label="US" market={data.us} />
          <div className="flex flex-col items-center gap-0.5 pl-2">
            <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">Crypto</span>
            <MiniArc value={data.crypto.value} color={zoneColor(data.crypto.value)} />
            <span className="text-[10px] font-medium" style={{ color: zoneColor(data.crypto.value) }}>
              {data.crypto.classification}
            </span>
          </div>
          <MarketGauge label="KR" market={data.kr} note="KOSPI proxy" />
        </div>
      )}
    </div>
  );
}
