"use client";
// P91 — Strategy Laboratory. Strategy DNA(factors/universe/horizon/entry/exit/risk/validation/failure/regimes).
// /console/strategy-lab. READ ONLY · 기존 실험/실패/리스크 재조립. 거래·집행 없음.
import { useState, useCallback } from "react";
import { getStrategyLab, type StrategyLabResp } from "@/lib/console-api";
import { PageHeader, KV } from "@/components/console/widgets";
import { Panel as P, PanelHead as PH, Badge as B } from "@/components/console/primitives";

export default function StrategyLab() {
  const [q, setQ] = useState("momentum");
  const [data, setData] = useState<StrategyLabResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true); setErr(null);
    try { setData(await getStrategyLab(name)); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  const dna = data?.dna;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P91" title="전략 랩" right={data?.type && <B tone="hud">{data.type}</B>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전략명으로 DNA 조회… (예: momentum)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer disabled:opacity-40">{loading ? "…" : "DNA 시퀀싱"}</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {data && dna && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <P>
              <PH kicker="전략 DNA" title={data.strategy ?? ""} />
              <div className="p-4 space-y-1.5">
                <KV k="팩터" v={(dna.factors ?? []).join(", ") || "—"} />
                <KV k="유니버스" v={dna.universe || "—"} />
                <KV k="투자 기간" v={dna.time_horizon || "—"} />
                <KV k="진입 로직" v={dna.entry_logic || "—"} />
                <KV k="청산 로직" v={dna.exit_logic || "—"} />
                <KV k="검증" v={Array.isArray(dna.validation_method) ? `${(dna.validation_method as unknown[]).length}개 항목` : String(dna.validation_method)} />
              </div>
            </P>
            <div className="space-y-4">
              <P>
                <PH kicker="리스크 모델" title="취약점" />
                <div className="p-4 space-y-1.5">
                  <KV k="주요 리스크" v={String((dna.risk_model as Record<string, unknown>)?.main_risk ?? "—")} />
                  <KV k="약점" v={String((dna.risk_model as Record<string, unknown>)?.weakness ?? "—")} mono={false} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(((dna.risk_model as Record<string, unknown>)?.category_flags ?? {}) as Record<string, string>).map(([c, sev]) => (
                      <B key={c} tone={sev === "HIGH" ? "neg" : sev === "MEDIUM" ? "warn" : "mute"}>{c} {sev}</B>
                    ))}
                  </div>
                </div>
              </P>
              <P>
                <PH kicker="히스토리" title="실패 & 국면"
                  right={data.repeated_mistakes?.made_this_mistake && <B tone="warn">반복 위험</B>} />
                <div className="p-4 space-y-2">
                  <KV k="실패 횟수" v={dna.failure_history?.count ?? 0} />
                  {data.repeated_mistakes?.headline && <div className="text-[10.5px] text-[var(--c-warn)]">{data.repeated_mistakes.headline}</div>}
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mt-2 mb-1">성공 국면</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(dna.successful_regimes ?? []).map((r) => <B key={r} tone="pos">{r}</B>)}
                    {(dna.successful_regimes ?? []).length === 0 && <span className="text-[10px] text-[var(--c-text-3)]">—</span>}
                  </div>
                </div>
              </P>
            </div>
          </div>
        )}
        {data?.note && !dna && <div className="c-panel p-6 text-center text-[12px] text-[var(--c-text-3)]">{data.note}</div>}
      </div>
    </div>
  );
}
