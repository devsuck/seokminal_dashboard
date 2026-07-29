"use client";
// Research Assistant — 대화형 진입점(헌장: The Assistant Is The Primary Interface).
// /console/assistant 에 질문을 보내 누적 지식으로 답한다. 읽기전용 · 분석·회상만, 결정/집행 없음.
import { useState, useEffect, useCallback } from "react";
import { getAssistant, getFailureIntel, type AssistantResp, type FailureIntelResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const STANCE_TONE: Record<string, string> = {
  SUPPORT: "var(--c-pos)", OPPOSE: "var(--c-neg)", CAUTION: "var(--c-warn)",
  NEUTRAL: "var(--c-text-3)", INFO: "var(--c-blue)",
};

const INTENT_LABEL: Record<string, string> = {
  recall: "MEMORY RECALL", failure: "FAILURE ANALYSIS", recent: "RECENT ACTIVITY",
  next_areas: "NEXT REVIEW", knowledge: "KNOWLEDGE", overview: "OVERVIEW",
  idle: "READY", empty: "—", error: "ERROR",
};

export default function Assistant() {
  const [q, setQ] = useState("");
  const [resp, setResp] = useState<AssistantResp | null>(null);
  const [fi, setFi] = useState<FailureIntelResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const run = useCallback(async (question: string) => {
    setLoading(true); setErr(null);
    try {
      const [r, f] = await Promise.all([
        getAssistant(question),
        getFailureIntel(question).catch(() => null),
      ]);
      setResp(r); setFi(f);
      if (question.trim()) setHistory((h) => [{ q: question, a: r.answer }, ...h].slice(0, 8));
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { run(""); }, [run]);   // 초기: 예시 질문 로드

  const suggestions = resp?.suggestions ?? [];
  const data = resp?.data as Record<string, unknown> | undefined;

  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Research Assistant"
        right={<Badge tone="hud">READ ONLY · NO EXECUTION</Badge>} />
      <div className="p-5 space-y-4 max-w-[900px]">
        {/* 질문 입력 */}
        <div className="panel-hud rounded-sm p-4">
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: Have we tried momentum?  ·  왜 실패했어?  ·  이번 주 뭐 바뀌었어?"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] rounded-sm px-3 h-10 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[color-mix(in_srgb,var(--c-hud)_45%,var(--c-border))]" />
            <button type="submit" disabled={loading}
              className="px-4 h-10 rounded-sm bg-[color-mix(in_srgb,var(--c-hud)_18%,transparent)] border border-[color-mix(in_srgb,var(--c-hud)_45%,var(--c-border))] text-[var(--c-hud)] text-[12px] font-semibold tracking-wide cursor-pointer disabled:opacity-50">
              {loading ? "…" : "Ask"}
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {suggestions.map((s) => (
              <button key={s} onClick={() => { setQ(s); run(s); }}
                className="text-[10.5px] px-2 py-1 rounded-[3px] bg-[var(--c-panel-2)] border border-[var(--c-border)] text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:border-[var(--c-border-2)] cursor-pointer">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 답변 */}
        {err && <div className="text-[11px] text-[var(--c-neg)] px-1">백엔드 연결 실패: {err}</div>}
        {resp && resp.intent !== "idle" && (
          <Panel className="overflow-hidden">
            <PanelHead kicker={INTENT_LABEL[resp.intent] ?? resp.intent.toUpperCase()}
              title={resp.topic ? `주제: ${resp.topic}` : "답변"}
              right={<Badge tone="mute">advisory</Badge>} />
            <div className="p-4 space-y-3">
              <div className="text-[14px] text-[var(--c-text-1)] leading-relaxed">{resp.answer}</div>
              {/* recall 근거 */}
              {resp.intent === "recall" && data && Array.isArray((data as {where?: string[]}).where) && (
                <div className="flex flex-wrap gap-1.5">
                  {((data as {where: string[]}).where).map((w) => (
                    <span key={w} className="c-num text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[color-mix(in_srgb,var(--c-hud)_10%,var(--c-panel-2))] border border-[color-mix(in_srgb,var(--c-hud)_25%,var(--c-border))] text-[var(--c-text-2)]">{w}</span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed border-t border-[var(--c-border)] pt-2">
                {resp.disclaimer ?? "어시스턴트는 분석·회상만 한다 — 결정/승인/집행은 사람이 한다."}
              </div>
            </div>
          </Panel>
        )}

        {/* 다관점 비평(Critic 포함) */}
        {fi?.perspectives && fi.perspectives.lenses.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="MULTI-PERSPECTIVE" title={`Perspectives · ${fi.perspectives.topic || "—"}`}
              right={<Badge tone={fi.perspectives.conflicting ? "warn" : "mute"}>{fi.perspectives.conflicting ? "CONFLICTING" : "aligned"}</Badge>} />
            <div className="p-3 space-y-1.5">
              {fi.perspectives.lenses.map((l) => (
                <div key={l.lens} className="grid grid-cols-[70px_74px_1fr] items-center gap-2.5">
                  <span className="text-[11.5px] text-[var(--c-text-1)]">{l.lens}</span>
                  <span className="c-num text-[9.5px] font-semibold tracking-wider px-1.5 py-0.5 rounded-[2px] text-center"
                    style={{ color: STANCE_TONE[l.stance], border: `1px solid color-mix(in srgb,${STANCE_TONE[l.stance]} 40%,transparent)`, background: `color-mix(in srgb,${STANCE_TONE[l.stance]} 8%,transparent)` }}>{l.stance}</span>
                  <span className="text-[10.5px] text-[var(--c-text-3)] truncate">{l.rationale}</span>
                </div>
              ))}
              <div className="text-[11px] text-[var(--c-text-1)] border-t border-[var(--c-border)] pt-2 mt-1">
                <span className="text-[var(--c-hud)] font-semibold">결론: </span>{fi.perspectives.conclusion}
              </div>
            </div>
          </Panel>
        )}

        {/* 실패 지능(9종 분류 분포) */}
        {fi?.failure_intelligence && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="FAILURE INTELLIGENCE" title="Failure Taxonomy"
              right={<span className="c-num text-[10px] text-[var(--c-text-3)]">{fi.failure_intelligence.total_failures} failures · top {fi.failure_intelligence.top_category}</span>} />
            <div className="p-4 space-y-1.5">
              {Object.entries(fi.failure_intelligence.by_category).length === 0 && (
                <div className="text-[11px] text-[var(--c-text-3)]">축적된 실패 기록 없음 — 실험이 쌓이면 9종으로 자동 분류됩니다.</div>
              )}
              {(() => {
                const cats = Object.entries(fi.failure_intelligence.by_category);
                const max = cats.length ? Math.max(...cats.map(([, n]) => n)) : 1;
                return cats.map(([c, n]) => (
                  <div key={c} className="grid grid-cols-[150px_1fr_24px] items-center gap-2.5">
                    <span className="text-[10.5px] text-[var(--c-text-2)] truncate">{c}</span>
                    <span className="h-2.5 bg-[var(--c-panel-3)] rounded-[2px] overflow-hidden">
                      <span className="block h-full rounded-[2px]" style={{ width: `${(n / max) * 100}%`, background: c === "UNCLASSIFIED" ? "var(--c-text-3)" : "var(--c-warn)" }} />
                    </span>
                    <span className="c-num text-[10.5px] text-[var(--c-text-1)] text-right">{n}</span>
                  </div>
                ));
              })()}
              {fi.failure_intelligence.lessons.length > 0 && (
                <div className="border-t border-[var(--c-border)] pt-2 mt-1 space-y-1">
                  {fi.failure_intelligence.lessons.slice(0, 5).map((l, i) => (
                    <div key={i} className="text-[10px] text-[var(--c-text-3)] leading-snug">· {l}</div>
                  ))}
                </div>
              )}
              <div className="text-[9.5px] text-[var(--c-text-3)] pt-1">
                메모리 그래프: 노드 <span className="c-num text-[var(--c-text-2)]">{fi.memory_graph.node_count}</span> · 엣지 <span className="c-num text-[var(--c-text-2)]">{fi.memory_graph.edge_count}</span> (실험→실패유형→교훈 연결)
              </div>
            </div>
          </Panel>
        )}

        {/* 히스토리 */}
        {history.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="SESSION" title="Recent Questions" />
            <div className="divide-y divide-[var(--c-border)]">
              {history.map((h, i) => (
                <button key={i} onClick={() => { setQ(h.q); run(h.q); }}
                  className="w-full text-left px-4 py-2.5 bg-transparent border-0 cursor-pointer hover:bg-[var(--c-panel-2)]">
                  <div className="text-[11.5px] text-[var(--c-text-1)]">{h.q}</div>
                  <div className="text-[10px] text-[var(--c-text-3)] truncate mt-0.5">{h.a}</div>
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
