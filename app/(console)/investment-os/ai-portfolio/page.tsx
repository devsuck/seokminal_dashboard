"use client";
// AI 포트폴리오 추천 — registry 검증 전략(paper_active+) 대상 Claude 배분 추천.
// /console/investment-os/ai-portfolio/*. READ ONLY — 추천만, 실행/주문 없음. 사람이 최종 결정.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getAiPortfolioLatest, getAiPortfolioHistory,
  type AiPortfolioResp, type AiPortfolioHistoryResp,
} from "@/lib/console-api";
import { ApPanel, ApPanelHead, ApBadge, ApSkeletonLines } from "@/components/ui/ApPrimitives";

export default function AiPortfolioPage() {
  const [latest, setLatest] = useState<AiPortfolioResp | null>(null);
  const [hist, setHist] = useState<AiPortfolioHistoryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      const [l, h] = await Promise.all([
        getAiPortfolioLatest(ctrl.signal),
        getAiPortfolioHistory(20, ctrl.signal),
      ]);
      if (!ctrl.signal.aborted) { setLatest(l); setHist(h); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { run(); return () => abortRef.current?.abort(); }, [run]);

  const weights = Object.entries(latest?.weights ?? {});

  return (
    <div className="min-h-full bg-ap-bg-page p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-ap-micro font-semibold tracking-[0.24em] uppercase text-ap-ink-3">
            registry 검증 전략(paper_active+) · 주 1회 자동 생성
          </div>
          <div className="text-ap-title font-semibold text-ap-ink-1">AI 포트폴리오 추천</div>
        </div>
        <Link href="/investment-os" className="text-ap-body text-ap-brand hover:underline no-underline">
          ← Investment OS
        </Link>
      </div>

      {/* Safety banner — 미션 핵심, 패널과 무관하게 항상 표시 */}
      <div className="bg-ap-surface border border-ap-line rounded-ap-lg p-3 flex flex-wrap items-center gap-2 text-ap-body">
        <span className="text-ap-micro tracking-[0.2em] text-ap-brand uppercase">보장 사항</span>
        <ApBadge tone="mute">추천 · 실배분/주문 아님 — 사람이 최종 결정</ApBadge>
      </div>

      <ApPanel>
        <ApPanelHead kicker="ai_portfolio · Claude CLI 배분 추천" title="최신 추천"
          right={<ApBadge tone="mute">{latest?.fallback_used ? "규칙 기반 폴백" : "Claude AI"}</ApBadge>} />
        <div className="p-4 space-y-2">
          {loading && <ApSkeletonLines rows={4} />}
          {!loading && err && <div className="text-ap-body text-ap-down">백엔드 연결 실패: {err}</div>}
          {!loading && !err && weights.length === 0 && (
            <div className="text-ap-body text-ap-ink-3">{latest?.note ?? "추천 없음"}</div>
          )}
          {!loading && !err && weights.map(([sid, w]) => (
            <div key={sid} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-ap-body text-ap-ink-1 w-52 truncate">{sid}</span>
                <div className="flex-1 h-1.5 bg-ap-line rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-ap-brand" style={{ width: `${w * 100}%` }} />
                </div>
                <span className="text-ap-body c-num text-ap-ink-3 w-14 text-right">{(w * 100).toFixed(1)}%</span>
              </div>
              {latest?.per_strategy_note?.[sid] && (
                <div className="text-ap-micro text-ap-ink-3 pl-1">{latest.per_strategy_note[sid]}</div>
              )}
            </div>
          ))}
          {!loading && !err && latest?.overall_rationale && (
            <div className="pt-2 border-t border-ap-line text-ap-body text-ap-ink-2 leading-relaxed">
              {latest.overall_rationale}
            </div>
          )}
        </div>
      </ApPanel>

      <ApPanel>
        <ApPanelHead kicker="이력" title="최근 추천 이력" right={hist && <ApBadge tone="mute">{hist.records.length}건</ApBadge>} />
        <div className="p-4 space-y-1.5">
          {loading && <ApSkeletonLines rows={3} />}
          {!loading && err && <div className="text-ap-body text-ap-down">백엔드 연결 실패: {err}</div>}
          {!loading && !err && (hist?.records.length ?? 0) === 0 && (
            <div className="text-ap-body text-ap-ink-3">이력 없음.</div>
          )}
          {!loading && !err && hist?.records.map((r) => (
            <div key={r.timestamp} className="flex items-center justify-between text-ap-body c-num text-ap-ink-2 border-b border-ap-line last:border-0 py-1">
              <span>{r.timestamp}</span>
              <span>{Object.keys(r.weights).length}개 전략{r.fallback_used ? " · 폴백" : ""}</span>
            </div>
          ))}
        </div>
      </ApPanel>
    </div>
  );
}
