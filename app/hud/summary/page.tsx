"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useHudFeed } from "@/components/hud/useHudFeed";
import { deriveAttentionItems } from "@/lib/attention";
import PortfolioTab from "@/components/hud/PortfolioTab";
import { ApPanel, ApPanelHead, ApHeroCard } from "@/components/ui/ApPrimitives";

function subscribeToMobileQuery(cb: () => void) {
  const m = matchMedia("(max-width: 767px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/* 폰 전용 요약 — 에이전틱 트레이딩 AI가 아는 걸 전부 보여주지 않고,
   사람이 봐야만 하는 것만: 성과 요약, 가동 여부, 실거래(LIVE) 게이트, 판단 필요 항목, 정합성 에러.
   나머지(유닛 로스터, 계좌 상세, 로그)는 /hud 전체 대시보드로 위임.
   데스크톱(md: 이상)은 기존 Dark Institutional 마크업 그대로(hidden md:block).
   모바일(md:hidden)은 ap-* 라이트 카드 토큰 — 2026-09-15 모바일 리디자인. */
export default function HudSummaryPage() {
  const { feed: f } = useHudFeed();
  const { lab, jarvis, sys, exec, health, pipeline, risk, ar, ios } = f;

  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    () => matchMedia("(max-width: 767px)").matches,
    () => false, // SSR snapshot: don't mount on the server
  );

  const busy = lab?.busy ?? false;
  const active = busy || (lab?.autopilot ?? false);
  const liveOn = jarvis?.live_execution === "enabled";
  const liveLabel = jarvis?.live_execution === "enabled" ? "가동" : jarvis?.live_execution === "disabled" ? "비활성" : "—";
  const wd = sys?.research_service?.watchdog;
  const critical = wd?.critical || exec?.arm_decision?.decision === "KILL";
  const attnLoading = !pipeline && !risk && !ios;

  const attentionItems = deriveAttentionItems({
    pipeline: pipeline ? { proposals: pipeline.proposals } : null,
    risk: risk ? { by_status: risk.by_status } : null,
    investmentOs: ios ? { gates: ios.gates, execution_ladder: ios.execution_ladder } : null,
    autoResearch: ar ? { n_candidates: ar.n_candidates } : null,
  });

  return (
    <>
      {/* ── 데스크톱(md 이상): 기존 다크 마크업, 무변경 ── */}
      <div className="hidden md:flex md:flex-col gap-3 p-4 pt-8 max-w-md mx-auto">
        <div className="px-1 text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">SEOKMINAL · 요약</div>

        <div className={`flex flex-col items-center justify-center gap-2 py-8 border ${
          liveOn ? "border-pos/50 bg-pos/10" : "border-border bg-panel"}`}>
          <span className={`w-3 h-3 rounded-full ${liveOn ? "bg-pos" : "bg-text-3"}`} />
          <span className={`text-3xl font-bold tracking-wide ${liveOn ? "text-pos" : "text-text-2"}`}>
            실거래 {liveLabel}
          </span>
        </div>

        {critical && (
          <div className="flex items-center gap-2 px-3 py-2.5 border border-neg/50 bg-neg/10">
            <span className="w-2 h-2 rounded-full bg-neg shrink-0" />
            <span className="text-sm font-bold text-neg">
              {wd?.critical && exec?.arm_decision?.decision === "KILL" ? "감시견 경보 · ARM 중단" : wd?.critical ? "감시견 경보" : "ARM 중단"}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 px-1 text-xs text-text-3">
          <span>
            상태 ▸ <span className={busy ? "text-accent" : active ? "text-pos" : "text-text-2"}>
              {busy ? "처리 중" : active ? "가동 중" : "대기"}
            </span>
          </span>
          <span className="text-text-3">·</span>
          <span>
            정합성 ▸ <span className={(health?.n_errors ?? 0) > 0 ? "text-neg" : health ? "text-pos" : "text-text-3"}>
              {health ? (health.ok ? "이상없음" : `오류 ${health.n_errors}`) : "로딩 중"}
            </span>
          </span>
        </div>

        <div className="border border-border bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-text-2">판단 필요</span>
            <span className="text-[11px] text-text-3 tabular-nums">{attentionItems.length}건</span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="px-3 py-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${attnLoading ? "bg-text-3" : "bg-pos"}`} />
              <span className="text-sm text-text-2">{attnLoading ? "로딩 중" : "판단 대기 항목 없음"}</span>
            </div>
          ) : (
            <div>
              {attentionItems.map((it) => (
                <Link key={it.id} href={it.href} className="flex items-start gap-2.5 border-b border-border px-3 py-3 no-underline last:border-b-0 active:opacity-70">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${it.tone === "neg" ? "bg-neg" : it.tone === "warn" ? "bg-warn" : "bg-info"}`} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-text-1">{it.label}</span>
                    <span className="text-xs text-text-3">{it.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/hud" className="block text-center text-sm text-text-3 no-underline active:opacity-70">
          전체 대시보드 →
        </Link>
      </div>

      {/* ── 모바일(md:hidden): 신규 라이트 카드 IA ── */}
      <div className="md:hidden bg-ap-bg min-h-full">
        <div className="px-4 pt-8 pb-1 max-w-md mx-auto">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-ap-ink-3">SEOKMINAL · 요약</span>
        </div>

        {isMobile && (
          <div className="max-w-md mx-auto">
            <PortfolioTab />
          </div>
        )}

        <div className="flex flex-col gap-3 px-4 pb-4 max-w-md mx-auto">
          <ApHeroCard
            label="SEOKMINAL"
            value={`실거래 ${liveLabel}`}
            valueCls={liveOn ? "text-ap-up" : "text-white/60"}
            rows={[
              { label: "상태", value: busy ? "처리 중" : active ? "가동 중" : "대기", cls: busy ? "text-ap-brand" : active ? "text-ap-up" : "text-ap-ink-2" },
              { label: "정합성", value: health ? (health.ok ? "이상없음" : `오류 ${health.n_errors}`) : "로딩 중", cls: (health?.n_errors ?? 0) > 0 ? "text-ap-down" : health ? "text-ap-up" : "text-ap-ink-3" },
            ]}
          />

          {critical && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-ap-lg border border-ap-down/50 bg-ap-down/10">
              <span className="w-2 h-2 rounded-full bg-ap-down shrink-0" />
              <span className="text-sm font-bold text-ap-down">
                {wd?.critical && exec?.arm_decision?.decision === "KILL" ? "감시견 경보 · ARM 중단" : wd?.critical ? "감시견 경보" : "ARM 중단"}
              </span>
            </div>
          )}

          <ApPanel>
            <ApPanelHead title="판단 필요" right={`${attentionItems.length}건`} />
            {attentionItems.length === 0 ? (
              <div className="px-3 py-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${attnLoading ? "bg-ap-ink-3" : "bg-ap-up"}`} />
                <span className="text-sm text-ap-ink-2">{attnLoading ? "로딩 중" : "판단 대기 항목 없음"}</span>
              </div>
            ) : (
              <div>
                {attentionItems.map((it) => (
                  <Link key={it.id} href={it.href} className="flex items-start gap-2.5 border-b border-ap-line px-3 py-3 no-underline last:border-b-0 active:opacity-70">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${it.tone === "neg" ? "bg-ap-down" : it.tone === "warn" ? "bg-ap-caution" : "bg-ap-note"}`} />
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm text-ap-ink-1">{it.label}</span>
                      <span className="text-xs text-ap-ink-3">{it.detail}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </ApPanel>

          <Link href="/hud" className="block text-center text-sm text-ap-ink-3 no-underline active:opacity-70">
            전체 대시보드 →
          </Link>
        </div>
      </div>
    </>
  );
}
