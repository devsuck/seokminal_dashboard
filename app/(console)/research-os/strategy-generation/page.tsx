"use client";
// P29 — Research Strategy Generation. 역사적 지식 기반 연구 전략 후보 원장(rsg_) 뷰.
// READ ONLY · GENERATED ≠ SELECTED · 선택·승인·배포·실행·거래 없음.
import { useCallback, useEffect, useRef, useState } from "react";
import { getResearchStrategyGeneration, type ResearchStrategyGenerationResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const STATE_TONE: Record<string, "hud" | "pos" | "warn" | "mute"> = {
  PROPOSED: "hud", ANALYZED: "hud", NOVELTY_CHECKED: "warn", REVIEWED: "pos", ARCHIVED: "mute",
};

export default function StrategyGeneration() {
  const [data, setData] = useState<ResearchStrategyGenerationResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getResearchStrategyGeneration(ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const s = data?.summary;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P29 · Research Strategy Generation" title="전략 후보 생성 원장"
        right={<button onClick={() => run()} disabled={loading}
          className="px-3.5 h-9 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-text-1)] border border-[var(--c-border)] hover:border-[var(--c-hud)] disabled:opacity-50 cursor-pointer">
          {loading ? "새로고침 중…" : "새로고침"}
        </button>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {loading && !data && (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--c-text-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
            <span className="text-[11px] tracking-wider">로딩 중…</span>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="세션" value={String(s?.session_count ?? 0)} sub={`이벤트 ${s?.session_event_count ?? 0}`} tone="hud" />
              <StatTile label="후보" value={String(s?.candidate_count ?? 0)} sub={`이벤트 ${s?.candidate_event_count ?? 0}`} tone="pos" />
              <StatTile label="가설" value={String(s?.hypothesis_count ?? 0)} sub={`신규성 ${s?.novelty_count ?? 0}`} tone="hud" />
              <StatTile label="증거/리포트" value={String(s?.evidence_count ?? 0)} sub={`리포트 ${s?.report_count ?? 0}`} tone="text-1" />
            </div>

            <Panel>
              <PanelHead kicker="rsg_candidates" title="전략 후보 (최신 상태)"
                right={<Badge tone="hud">{data.candidates.length}</Badge>} />
              <div className="p-4 space-y-2">
                {data.candidates.length === 0 && (
                  <div className="text-[11px] text-[var(--c-text-3)] py-6 text-center">
                    아직 생성된 후보 없음 — historical_candidate_bridge가 호출되면 여기 쌓임.
                  </div>
                )}
                {data.candidates.map((c) => (
                  <div key={c.candidate_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{c.statement}</span>
                      <div className="flex gap-1 shrink-0">
                        <Badge tone="mute">{c.category}</Badge>
                        <Badge tone={STATE_TONE[c.state] ?? "mute"}>{c.state}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>세션 {c.session_id}</span>
                      <span>{c.occurred_at}</span>
                      {c.source_refs.length > 0 && <span>근거 {c.source_refs.length}건</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
