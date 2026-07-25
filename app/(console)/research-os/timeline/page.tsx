"use client";
// P78 — Research Timeline. 기존 append-only 원장에서 재구성한 연구 타임라인. /console/research-timeline.
// READ ONLY · 새 히스토리 DB 없음.
import { useState, useCallback, useEffect } from "react";
import { getResearchTimeline, type TimelineResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const STAGE_TONE: Record<string, string> = {
  Idea: "var(--c-text-3)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-hud)",
  Backtest: "var(--c-hud)", Validation: "var(--c-pos)", Failure: "var(--c-neg)",
  Lesson: "var(--c-emerald)", "Portfolio Effect": "var(--c-blue)", Risk: "var(--c-neg)",
  Paper: "var(--c-blue)", "Decision Memo": "var(--c-warn)", "Human Review": "var(--c-warn)",
  Archive: "var(--c-text-3)",
};

export default function Timeline() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<TimelineResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (topic: string) => {
    setLoading(true); setErr(null);
    try { setData(await getResearchTimeline(topic)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { run(""); }, [run]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P78" title="Research Timeline"
        right={data && <Badge tone="mute">{data.count} events</Badge>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전략/주제로 필터…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-9 text-[12px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-9 text-[10.5px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">Filter</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* 스테이지 분포 */}
            <div className="flex flex-wrap gap-1.5">
              {data.stage_order.filter((s) => data.by_stage[s]).map((s) => (
                <Badge key={s} tone="mute">{s} · {data.by_stage[s]}</Badge>
              ))}
            </div>
            <Panel>
              <PanelHead kicker="Reconstructed" title="Idea → … → Archive" />
              <div className="p-4">
                {data.count === 0 && !loading && <div className="text-[11px] text-[var(--c-text-3)] py-8 text-center">원장에서 재구성할 이벤트 없음 — 연구가 기록되면 타임라인이 채워집니다.</div>}
                <div className="relative pl-4">
                  {(data.entries ?? []).map((e, i) => {
                    const c = STAGE_TONE[e.stage] ?? "var(--c-text-3)";
                    return (
                      <div key={i} className="relative pb-3">
                        <span className="absolute left-[-11px] top-1 h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                        {i < data.entries.length - 1 && <span className="absolute left-[-7px] top-3 bottom-0 w-px bg-[var(--c-border)]" />}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: c }}>{e.stage}</span>
                          <span className="text-[11px] text-[var(--c-text-1)]">{e.label || e.ref}</span>
                          <span className="text-[9px] c-num text-[var(--c-text-3)] ml-auto">{e.source} · {e.timestamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)]">{data.note}</div>
          </>
        )}
      </div>
    </div>
  );
}
