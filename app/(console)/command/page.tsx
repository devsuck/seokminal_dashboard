"use client";

import { useEffect, useState } from "react";
import {
  getConsoleStatus, getConsolePipeline, getConsoleRegime, getConsoleCouncil,
  type ConsoleStatus, type ConsolePipeline, type ConsoleRegime, type ConsoleCouncil,
} from "@/lib/console-api";
import { Panel, PanelHead, StatTile, Badge, Dot, Meter } from "@/components/console/primitives";

function useClock() {
  const [t, setT] = useState<string>("");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19) + "Z");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}


export default function CommandCenter() {
  const clock = useClock();
  const [status, setStatus] = useState<ConsoleStatus | null>(null);
  const [pipeline, setPipeline] = useState<ConsolePipeline | null>(null);
  const [regime, setRegime] = useState<ConsoleRegime | null>(null);
  const [council, setCouncil] = useState<ConsoleCouncil | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const [s, p, r, c] = await Promise.all([
          getConsoleStatus(ac.signal),
          getConsolePipeline(ac.signal),
          getConsoleRegime(ac.signal).catch(() => null),
          getConsoleCouncil(8, ac.signal).catch(() => null),
        ]);
        setStatus(s); setPipeline(p); setRegime(r); setCouncil(c); setErr(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const live = status?.autonomy.live_execution_enabled;
  const regimeName = (regime?.regime ?? "UNKNOWN").toUpperCase();
  const posture = regime?.posture ?? null;

  return (
    <div className="min-h-full">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 h-12 px-5 border-b border-[var(--c-border)] bg-[color-mix(in_srgb,var(--c-bg)_85%,transparent)] backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold tracking-[0.24em] text-[var(--c-text-1)] uppercase">Command Center</span>
          <Badge tone={live ? "pos" : "warn"}>{live ? "LIVE ARMED" : "SAFE · PROPOSAL-ONLY"}</Badge>
        </div>
        <div className="flex items-center gap-4 text-[10px] c-num text-[var(--c-text-2)]">
          <span className="flex items-center gap-1.5"><Dot tone="pos" pulse /> SYSTEMS NOMINAL</span>
          <span className="text-[var(--c-hud)]">{clock}</span>
        </div>
      </header>

      {err && (
        <div className="m-5 c-panel p-4 text-[12px] text-[var(--c-neg)]">
          백엔드 연결 실패: {err} · <span className="text-[var(--c-text-3)]">api_server(:8000) 기동 여부를 확인하세요.</span>
        </div>
      )}

      <div className="p-5 space-y-5 max-w-[1400px]">
        {/* ── JARVIS STATUS hero ── */}
        <Panel hud grid className="p-0 overflow-hidden">
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[var(--c-border)]">
            {/* Portfolio Posture (정직한 파생 지표) */}
            <div className="p-5">
              <div className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-hud)] uppercase">
                <Dot tone="hud" pulse /> JARVIS · Portfolio Posture
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-[30px] leading-none font-semibold tracking-tight text-[var(--c-hud)]">
                  {posture?.label ?? "—"}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] c-num text-[var(--c-text-2)] mb-1.5">
                  <span>CONVICTION</span>
                  <span className="text-[var(--c-text-1)]">{posture ? `${Math.round(posture.confidence * 100)}%` : "—"}</span>
                </div>
                <Meter value={posture?.confidence ?? 0} tone="hud" />
                <div className="mt-2 text-[10px] text-[var(--c-text-3)]">
                  {posture ? `${posture.total_active} active · market regime: ${regimeName}` : (regime?.note ?? "데이터 없음")}
                </div>
              </div>
            </div>
            {/* Capital */}
            <div className="p-5">
              <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-text-3)] uppercase">Capital · Paper NAV</div>
              <div className="mt-3 c-num text-[30px] leading-none font-semibold text-[var(--c-text-1)]">
                {status?.capital.capital != null ? `$${(status.capital.capital / 1e6).toFixed(2)}M` : "—"}
              </div>
              <div className="mt-4 space-y-2 text-[11px] c-num">
                <Row k="Gross exposure" v={`$${(status?.capital.gross_exposure ?? 0).toLocaleString()}`} />
                <Row k="Positions" v={String(status?.capital.n_positions ?? 0)} />
              </div>
            </div>
            {/* Exposure + autonomy */}
            <div className="p-5">
              <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-text-3)] uppercase">Exposure</div>
              <div className="mt-3 c-num text-[30px] leading-none font-semibold text-[var(--c-hud)]">
                {(status?.capital.exposure_pct ?? 0).toFixed(1)}<span className="text-[16px] text-[var(--c-text-2)]">%</span>
              </div>
              <div className="mt-3"><Meter value={(status?.capital.exposure_pct ?? 0) / 100} tone="hud" /></div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] c-num tracking-wider text-[var(--c-text-2)]">AUTONOMY L{status?.autonomy.level ?? "?"}</span>
                <Badge tone={live ? "pos" : "warn"}>{live ? "LIVE" : "GATED"}</Badge>
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Strategies" value={status?.strategies.active ?? "—"} unit={`/ ${status?.strategies.total ?? "—"} total`}
            tone="hud" accent="hud"
            sub={<span className="c-num">{status?.strategies.by_status?.paper_active ?? 0} paper · {status?.strategies.by_status?.draft ?? 0} draft</span>}
          />
          <StatTile
            label="Risk Governor" value={loading ? "…" : "ACTIVE"} tone="pos" accent="pos"
            sub={<span>{status?.boundaries.risk_governor ?? "—"}</span>}
          />
          <StatTile
            label="Autonomy" value={`L${status?.autonomy.level ?? "?"}`} unit={`/ L${status?.autonomy.min_live ?? "?"} live`}
            tone={live ? "pos" : "warn"} accent={live ? "pos" : "warn"}
            sub={<span className="truncate block">{status?.autonomy.name ?? "—"}</span>}
          />
          <StatTile
            label="Live Capital" value={live ? "ARMED" : "CLOSED"} tone={live ? "pos" : "warn"} accent={live ? "pos" : "warn"}
            sub={<span>{status?.boundaries.live_execution ?? "—"}</span>}
          />
        </div>

        {/* ── Council + Pipeline ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CouncilCard council={council} />
          <PipelineCard pipeline={pipeline} />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--c-text-3)]">{k}</span>
      <span className="text-[var(--c-text-1)]">{v}</span>
    </div>
  );
}

function CouncilCard({ council }: { council: ConsoleCouncil | null }) {
  const has = council && council.count > 0;
  return (
    <Panel className="flex flex-col">
      <PanelHead kicker="AI COUNCIL" title="Latest Decision" right={<Badge tone="hud">{council?.source ?? "—"}</Badge>} />
      <div className="p-4 flex-1">
        {!has ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <Dot tone="mute" />
            <div className="mt-3 text-[12px] text-[var(--c-text-2)]">활성 카운슬 결정 없음</div>
            <div className="mt-1 text-[10.5px] text-[var(--c-text-3)]">제안·승인 파이프라인이 결정을 생성하면 여기에 표시됩니다.</div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {council!.decisions.slice(-6).reverse().map((d, i) => (
              <li key={i} className="flex items-start gap-3 border-l-2 border-[var(--c-hud)] pl-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-[var(--c-text-1)] truncate">
                    {String((d.action ?? d.decision ?? d.event ?? d.message ?? "decision"))}
                  </div>
                  <div className="text-[10px] c-num text-[var(--c-text-3)] mt-0.5 truncate">
                    {String((d.strategy ?? d.proposal_id ?? d.layer ?? "") || "")} {String(d.timestamp ?? d.ts ?? "")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

const STAGE_TONE = (byStatus: Record<string, number>, count: number): "pos" | "warn" | "neg" | "mute" => {
  if (count === 0) return "mute";
  const keys = Object.keys(byStatus);
  if (keys.some((k) => ["FAILED", "BLOCKED", "REJECTED"].includes(k))) return "neg";
  if (keys.some((k) => ["WARNING", "CLOSED"].includes(k))) return "warn";
  return "pos";
};

function PipelineCard({ pipeline }: { pipeline: ConsolePipeline | null }) {
  return (
    <Panel className="flex flex-col">
      <PanelHead
        kicker="EXECUTION" title="P8 Pipeline"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{pipeline?.proposals ?? 0} prop · {pipeline?.approvals ?? 0} appr</span>}
      />
      <div className="p-3">
        <div className="grid grid-cols-1 divide-y divide-[var(--c-border)]">
          {(pipeline?.stages ?? []).map((s) => {
            const tone = STAGE_TONE(s.by_status, s.count);
            return (
              <div key={s.key} className="flex items-center gap-3 py-2 px-1">
                <Dot tone={tone} />
                <span className="text-[11.5px] text-[var(--c-text-2)] flex-1 truncate">{s.label}</span>
                <span className="c-num text-[11px] text-[var(--c-text-3)]">
                  {Object.keys(s.by_status).length ? Object.entries(s.by_status).map(([k, v]) => `${k}:${v}`).join(" ") : "—"}
                </span>
                <span className="c-num text-[13px] font-semibold text-[var(--c-text-1)] w-8 text-right">{s.count}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 px-1 text-[10px] text-[var(--c-text-3)] leading-relaxed">{pipeline?.note}</div>
      </div>
    </Panel>
  );
}
