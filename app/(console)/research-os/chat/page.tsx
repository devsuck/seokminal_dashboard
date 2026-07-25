"use client";
// P69 — Conversational Research Workspace. 채팅이 주 조작 인터페이스.
// 질문 → Decision Memo + Evidence + Memory Recall + Suggested actions. READ ONLY · 분석/회상만, 결정/집행 없음.
import { useState, useCallback } from "react";
import {
  getAssistant, getDecisionMemo, getExplainability,
  type AssistantResp, type DecisionMemoResp, type ExplainabilityResp,
} from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const CONF_TONE: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const SUGGESTIONS = ["Continue yesterday's research", "Have we tried momentum?", "Should we research value rotation?", "Why did TSMOM fail?"];

export default function ResearchChat() {
  const [q, setQ] = useState("");
  const [turn, setTurn] = useState<{ q: string; memo: DecisionMemoResp; ev: ExplainabilityResp; recall: AssistantResp } | null>(null);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setLoading(true); setErr(null);
    try {
      const [memo, ev, recall] = await Promise.all([
        getDecisionMemo(question), getExplainability(question), getAssistant(question),
      ]);
      setTurn({ q: question, memo, ev, recall });
      setHistory((h) => [{ q: question, a: memo.recommendation ?? recall.answer }, ...h].slice(0, 8));
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P69" title="Research Chat"
        right={<span className="text-[9.5px] tracking-wider text-[var(--c-text-3)] uppercase">Primary Interface</span>} />
      <div className="p-5">
        {/* 입력 */}
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문… (예: Continue yesterday's research)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading || !q.trim()}
            className="px-4 h-10 text-[11px] font-semibold tracking-wide uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-hud)_18%,transparent)] disabled:opacity-40 cursor-pointer transition-colors">
            {loading ? "…" : "Ask"}
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => { setQ(s); run(s); }}
              className="px-2.5 py-1 text-[10px] text-[var(--c-text-2)] border border-[var(--c-border)] hover:border-[var(--c-hud)] hover:text-[var(--c-hud)] bg-transparent cursor-pointer transition-colors">
              {s}
            </button>
          ))}
        </div>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)] mb-4">백엔드 연결 실패: {err}</div>}

        {turn && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 대화 + 답변 */}
            <div className="lg:col-span-2 space-y-4">
              <Panel>
                <PanelHead kicker="Recommendation" title={turn.q}
                  right={turn.memo.confidence && <Badge tone={CONF_TONE[turn.memo.confidence] ?? "mute"}>{turn.memo.confidence}</Badge>} />
                <div className="p-4 space-y-3">
                  <div className="text-[13px] font-medium text-[var(--c-hud)]">{turn.memo.recommendation ?? turn.recall.answer}</div>
                  {turn.memo.rationale && <div className="text-[11px] text-[var(--c-text-2)] leading-relaxed">{turn.memo.rationale}</div>}
                  {/* 지지 vs 반대 */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1.5">Supporting</div>
                      {(turn.memo.supporting_arguments ?? []).map((a, i) => (
                        <div key={i} className="text-[10.5px] text-[var(--c-text-2)] mb-1">· <b className="text-[var(--c-text-1)]">{a.lens}</b> {a.rationale}</div>
                      ))}
                      {(turn.memo.supporting_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}
                    </div>
                    <div>
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1.5">Counter</div>
                      {(turn.memo.counter_arguments ?? []).map((a, i) => (
                        <div key={i} className="text-[10.5px] text-[var(--c-text-2)] mb-1">· <b className="text-[var(--c-text-1)]">{a.lens}</b> {a.rationale}</div>
                      ))}
                      {(turn.memo.counter_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}
                    </div>
                  </div>
                </div>
              </Panel>

              {/* 대화 히스토리 */}
              {history.length > 1 && (
                <Panel>
                  <PanelHead kicker="Conversation" title="History" />
                  <div className="p-4 space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="text-[11px]">
                        <span className="text-[var(--c-text-3)]">Q:</span> <span className="text-[var(--c-text-1)]">{h.q}</span>
                        <span className="text-[var(--c-hud)] ml-2">→ {h.a}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            {/* 연구 컨텍스트 */}
            <div className="space-y-4">
              <Panel>
                <PanelHead kicker="Memory" title="Recall" />
                <div className="p-4">
                  <div className="text-[11px] text-[var(--c-text-2)]">{turn.recall.answer}</div>
                  {turn.recall.topic && <div className="text-[10px] text-[var(--c-text-3)] mt-1">topic: {turn.recall.topic}</div>}
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Explainability" title="Referenced Experiments" />
                <div className="p-4 space-y-1">
                  {(turn.ev.references_experiments ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">참조된 과거 실험 없음.</div>}
                  {(turn.ev.references_experiments ?? []).map((r, i) => (
                    <div key={i} className="text-[10.5px] c-num text-[var(--c-text-2)]">· {r}</div>
                  ))}
                  <div className="text-[10px] text-[var(--c-text-3)] mt-1.5">confidence: <b style={{ color: `var(--c-${turn.ev.confidence === "HIGH" ? "pos" : turn.ev.confidence === "LOW" ? "warn" : "hud"})` }}>{turn.ev.confidence}</b></div>
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="Suggested" title="Next Actions" />
                <div className="p-4 space-y-1.5">
                  {(turn.memo.suggested_next_research ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">제안 없음.</div>}
                  {(turn.memo.suggested_next_research ?? []).map((s, i) => (
                    <button key={i} onClick={() => { setQ(s); run(s); }}
                      className="block text-left text-[10.5px] text-[var(--c-text-2)] hover:text-[var(--c-hud)] bg-transparent border-0 cursor-pointer p-0">→ {s}</button>
                  ))}
                </div>
              </Panel>
              {(turn.memo.remaining_unknowns ?? []).length > 0 && (
                <Panel>
                  <PanelHead kicker="Gaps" title="Remaining Unknowns" />
                  <div className="p-4 space-y-1">
                    {turn.memo.remaining_unknowns!.map((u, i) => (
                      <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {u}</div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}
        {!turn && !loading && (
          <div className="c-panel p-8 text-center text-[12px] text-[var(--c-text-3)]">
            질문을 입력하면 Decision Memo · 증거 · 메모리 회상 · 다음 액션을 함께 보여줍니다.<br />
            <span className="text-[10.5px]">분석·회상만 — 투자 결정·집행은 사람이 합니다.</span>
          </div>
        )}
      </div>
    </div>
  );
}
