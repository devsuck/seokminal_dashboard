"use client";

import { useEffect, useState } from "react";
import { statusColor, formatLatency, type StatusState } from "@/lib/system-status-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function todayKrx(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

const CHECKS = [
  { label: "API Server", url: () => `${API_URL}/bars?instrument_id=AAPL.NASDAQ&start=2025-01-01&end=2025-01-02` },
  { label: "KRX Data",   url: () => `${API_URL}/krx/index?bas_dd=${todayKrx()}&index_type=KOSPI` },
  { label: "FRED/Macro", url: () => `${API_URL}/fred/catalog` },
  { label: "Bot Engine", url: () => `${API_URL}/bots` },
] as const;

interface ServiceStatus {
  label: string;
  state: StatusState;
  latencyMs: number | null;
}

async function ping(url: string): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

export function SystemStatusWidget() {
  const [services, setServices] = useState<ServiceStatus[]>(
    CHECKS.map(c => ({ label: c.label, state: "checking" as StatusState, latencyMs: null }))
  );

  useEffect(() => {
    let alive = true;

    async function runChecks() {
      const results = await Promise.all(
        CHECKS.map(async c => {
          const { ok, ms } = await ping(c.url());
          return { label: c.label, state: (ok ? "online" : "error") as StatusState, latencyMs: ms };
        })
      );
      if (alive) setServices(results);
    }

    runChecks();
    const id = setInterval(runChecks, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const anyChecking = services.some(s => s.state === "checking");
  const allOnline   = services.every(s => s.state === "online");

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          System Status
        </span>
        <span className={`text-[10px] font-data ${anyChecking ? "text-warn" : allOnline ? "text-pos" : "text-neg"}`}>
          {anyChecking ? "Checking…" : allOnline ? "All Operational" : "Degraded"}
        </span>
      </div>

      <div className="space-y-2.5">
        {services.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                s.state === "online"   ? "bg-pos" :
                s.state === "error"    ? "bg-neg" :
                                         "bg-warn animate-pulse"
              }`} />
              <span className="text-text-2 text-xs">{s.label}</span>
            </div>
            <span className={`text-[11px] font-data ${statusColor(s.state)}`}>
              {s.state === "checking" ? "…" :
               s.state === "online"   ? formatLatency(s.latencyMs) :
                                        "Error"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
