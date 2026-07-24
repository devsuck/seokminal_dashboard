"use client";
// Research OS — Jarvis 로컬 연구 환경(P41~P45) 통합 뷰.
// 백엔드 research_navigation 매니페스트를 소비해 Research/Knowledge/Agents/System IA 를 렌더하고,
// 각 섹션·항목·능력을 이 콘솔의 기존 라우트로 연결한다. 읽기전용 · 결정/거래/집행 없음.
import Link from "next/link";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";
import {
  RESEARCH_OS_SECTIONS, RESEARCH_OS_META, RESEARCH_OS_CAPABILITIES,
} from "@/lib/research-os";

export default function ResearchOS() {
  const m = RESEARCH_OS_META;
  return (
    <div className="min-h-full">
      <PageHeader
        kicker="INTELLIGENCE"
        title="Research OS · Local Research Environment"
        right={<Badge tone="hud">READ ONLY · NO EXECUTION</Badge>}
      />
      <div className="p-5 space-y-5 max-w-[1150px]">
        {/* 상단 지표 — 매니페스트 실측 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Sections" value={m.sectionCount} sub={`${m.itemCount} nav items`} accent="hud" tone="hud" />
          <StatTile label="Backend Modules" value={m.moduleCount} sub="P41 audit inventory" accent="info" />
          <StatTile label="Nav Coverage" value={`${Math.round(m.coverage * 100)}%`} sub="all modules placed" accent="pos" tone="pos" />
          <StatTile label="Consolidation Candidates" value={m.duplicateFamilies} sub="duplicate families" accent="warn" tone="warn" />
        </div>

        {/* 네비게이션 IA — 섹션별 항목이 기존 라우트로 연결 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P43 · UNIFIED NAVIGATION" title="Home → Research / Knowledge / Agents / System" />
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {RESEARCH_OS_SECTIONS.map((s) => (
              <div key={s.section} className="border border-[var(--c-border)] rounded-sm overflow-hidden">
                <div className="flex items-center gap-2 px-3 h-9 bg-[var(--c-panel-2)] border-b border-[var(--c-border)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)]" />
                  <span className="text-[12px] font-semibold tracking-wide text-[var(--c-text-1)]">{s.section}</span>
                  <span className="c-num text-[10px] text-[var(--c-text-3)] ml-auto">{s.moduleCount} modules</span>
                </div>
                <div className="divide-y divide-[var(--c-border)]">
                  {s.items.map((it) => (
                    <Link key={it.item} href={it.href} className="flex items-center gap-3 px-3 py-2 no-underline hover:bg-[var(--c-panel-2)] transition-colors">
                      <span className="text-[12px] text-[var(--c-text-1)] w-24 shrink-0">{it.item}</span>
                      <span className="text-[10.5px] text-[var(--c-text-3)] flex-1 truncate">{it.note}</span>
                      <span className="c-num text-[10px] text-[var(--c-text-2)]">{it.moduleCount}</span>
                      <span className="c-num text-[9.5px] text-[var(--c-hud)] tracking-wider">{it.href}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3 text-[10px] text-[var(--c-text-3)]">
            출처: {m.source} · digest <span className="c-num">{m.digest}</span> · 기존 페이지 재배치(신규 대시보드 없음, 기능 보존)
          </div>
        </Panel>

        {/* P41~P45 능력 카드 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P41 – P45" title="Local Research Environment Capabilities" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {RESEARCH_OS_CAPABILITIES.map((c) => (
              <Link key={c.phase} href={c.href} className="block no-underline border border-[var(--c-border)] rounded-sm p-3 hover:bg-[var(--c-panel-2)] transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="c-num text-[9.5px] font-semibold tracking-widest text-[var(--c-hud)]">{c.phase}</span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-1)]">{c.name}</span>
                  <span className="ml-auto"><Badge tone={c.live ? "pos" : "mute"}>{c.live ? "LINKED" : "BACKEND"}</Badge></span>
                </div>
                <div className="text-[11px] text-[var(--c-text-2)] leading-relaxed">{c.summary}</div>
              </Link>
            ))}
          </div>
        </Panel>

        {/* 안전 고지 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="SAFETY" title="Research Authority Only" />
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--c-text-2)] w-40 shrink-0">Nav coverage</span>
              <div className="flex-1"><Meter value={m.coverage} tone="pos" /></div>
              <span className="c-num text-[10.5px] text-[var(--c-text-2)] w-12 text-right">{Math.round(m.coverage * 100)}%</span>
            </div>
            <div className="text-[10.5px] text-[var(--c-text-3)] leading-relaxed">
              이 뷰는 백엔드 원장을 <span className="text-[var(--c-text-1)]">READ ONLY</span> 로 요약한다.
              분석·추천·요약만 하며 자동 거래·자동 배포·자동 자본 배분·전략 승인을 하지 않는다
              (P44 assistant analyzes · P45 automation = workflow assistance).
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
