"use client";
// P93 — Human Decision Center (Investment Committee). 7관점 협의체 + Decision Memo 패킷.
// /console/council-expanded + /console/decision-memo. READ ONLY · 논거·증거 조직, 결정은 사람.
import { useState, useCallback } from "react";
import { getCouncilExpanded, getDecisionMemo, type CouncilExpandedResp, type DecisionMemoResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const STANCE: Record<string, string> = { SUPPORT: "var(--c-pos)", INFO: "var(--c-blue)", NEUTRAL: "var(--c-text-3)", CAUTION: "var(--c-warn)", OPPOSE: "var(--c-neg)" };
const CONF: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };

export default function Committee() {
  const [q, setQ] = useState("");
  const [council, setCouncil] = useState<CouncilExpandedResp | null>(null);
  const [memo, setMemo] = useState<DecisionMemoResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setLoading(true); setErr(null);
    try { const [c, m] = await Promise.all([getCouncilExpanded(question), getDecisionMemo(question)]); setCouncil(c); setMemo(m); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  return (
    <div className="min-h-full">
      <PageHeader kicker="P93" title="Investment Committee" right={memo?.confidence && <Badge tone={CONF[memo.confidence] ?? "mute"}>{memo.confidence}</Badge>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="투자 논제… (예: Should we deploy momentum?)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading} className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer disabled:opacity-40">{loading ? "…" : "Convene"}</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {council && memo && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 7관점 */}
            <div className="lg:col-span-2 space-y-4">
              <Panel>
                <PanelHead kicker="P90 · 7 Perspectives" title="Council" right={<Badge tone="hud">{council.recommendation?.split("—")[0]?.trim()}</Badge>} />
                <div className="p-4 space-y-2">
                  {(council.lenses ?? []).map((ln, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5 border-b border-[var(--c-border)] last:border-0">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STANCE[ln.stance] ?? "var(--c-text-3)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-[var(--c-text-1)]">{ln.lens}</span><span className="text-[9px] c-num uppercase" style={{ color: STANCE[ln.stance] ?? "var(--c-text-3)" }}>{ln.stance}</span></div>
                        <div className="text-[10.5px] text-[var(--c-text-3)]">{ln.rationale}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Committee Packet" title={q} />
                <div className="p-4 space-y-3">
                  <div className="text-[13px] font-medium text-[var(--c-hud)]">{memo.recommendation}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1">Supporting</div>{(memo.supporting_arguments ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· <b>{a.lens}</b> {a.rationale}</div>)}{(memo.supporting_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}</div>
                    <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">Counter</div>{(memo.counter_arguments ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· <b>{a.lens}</b> {a.rationale}</div>)}{(memo.counter_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}</div>
                  </div>
                </div>
              </Panel>
            </div>
            {/* 리스크·미지·이력 */}
            <div className="space-y-4">
              <Panel>
                <PanelHead kicker="Risk" title="Analysis" />
                <div className="p-4 space-y-1">
                  <div className="text-[11px] text-[var(--c-text-1)]">{memo.risk_summary?.label}</div>
                  <div className="text-[10.5px] text-[var(--c-text-3)]">main: {memo.risk_summary?.main_risk} · conf {memo.risk_summary?.confidence}</div>
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Gaps" title="Remaining Unknowns" />
                <div className="p-4 space-y-1">
                  {(memo.remaining_unknowns ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">—</div>}
                  {(memo.remaining_unknowns ?? []).map((u, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {u}</div>)}
                </div>
              </Panel>
              <div className="c-panel p-3 text-[10px] text-[var(--c-text-3)] leading-relaxed">
                위원회는 증거를 조직합니다. 결정·이유·시각은 사람이 입력하고 기존 감사(rwf_runs)에 기록됩니다. 엔진은 승인/집행하지 않습니다.
              </div>
            </div>
          </div>
        )}
        {!council && !loading && <div className="c-panel p-8 text-center text-[12px] text-[var(--c-text-3)]">논제를 입력하면 7관점 협의체 + Decision Memo 패킷을 제시합니다. 최종 결정은 사람.</div>}
      </div>
    </div>
  );
}
