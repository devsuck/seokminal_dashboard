"use client";
// Research OS — Jarvis 로컬 연구 환경(P41~P45) 라이브 통합 뷰.
// 백엔드 /console/research-os 를 폴링해 실데이터(감사·런타임·어시스턴트·자동화)를 렌더한다.
// 백엔드가 없으면 정적 매니페스트(P43 산출물)로 폴백. 읽기전용 · 결정/거래/집행 없음.
import Link from "next/link";
import { getResearchOS } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";
import {
  RESEARCH_OS_SECTIONS, RESEARCH_OS_META, RESEARCH_OS_CAPABILITIES,
  itemHref, itemNote, capHref,
} from "@/lib/research-os";

export default function ResearchOS() {
  const { data, err, loading } = useConsole(getResearchOS, [], 30000);

  // 라이브 우선, 없으면 정적 폴백
  const live = !!data;
  const meta = data?.meta ?? {
    section_count: RESEARCH_OS_META.sectionCount, item_count: RESEARCH_OS_META.itemCount,
    module_count: RESEARCH_OS_META.moduleCount, coverage: RESEARCH_OS_META.coverage,
    duplicate_families: RESEARCH_OS_META.duplicateFamilies, digest: RESEARCH_OS_META.digest,
  };
  const sections = data?.sections ?? RESEARCH_OS_SECTIONS.map((s) => ({
    section: s.section, moduleCount: s.moduleCount,
    items: s.items.map((i) => ({ item: i.item, moduleCount: i.moduleCount })),
  }));
  const caps = data?.capabilities ?? RESEARCH_OS_CAPABILITIES.map((c) => ({
    phase: c.phase, name: c.name, summary: c.summary, metric: c.live ? "LINKED" : "BACKEND",
  }));

  const rt = data?.runtime;
  const asst = data?.assistant;
  const auto = data?.automation;

  return (
    <div className="min-h-full">
      <PageHeader
        kicker="INTELLIGENCE"
        title="Research OS · Local Research Environment"
        right={<>
          <Badge tone={live ? "pos" : "mute"}>{live ? "LIVE" : loading ? "…" : "CACHED"}</Badge>
          <Badge tone="hud">READ ONLY · NO EXECUTION</Badge>
        </>}
      />
      <div className="p-5 space-y-5 max-w-[1150px]">
        {/* 상단 지표 — 라이브(폴백 정적) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Sections" value={meta.section_count} sub={`${meta.item_count} nav items`} accent="hud" tone="hud" />
          <StatTile label="Backend Modules" value={meta.module_count} sub="P41 audit inventory" accent="info" />
          <StatTile label="Nav Coverage" value={`${Math.round(meta.coverage * 100)}%`} sub="all modules placed" accent="pos" tone="pos" />
          <StatTile label="Consolidation Candidates" value={meta.duplicate_families} sub="duplicate families" accent="warn" tone="warn" />
        </div>

        {/* 라이브 런타임/어시스턴트/자동화 상태 */}
        {live && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Runtime Health" value={rt?.health_status ?? "—"} sub={`env ${rt?.env_status ?? "—"}`}
              tone={rt?.health_status === "OK" ? "pos" : rt?.health_status === "WARN" ? "warn" : "neg"}
              accent={rt?.health_status === "OK" ? "pos" : "warn"} />
            <StatTile label="Assistant Records" value={asst?.total_records ?? 0} sub={`${asst?.active_sources ?? 0} active sources`} accent="info" />
            <StatTile label="Failures Tracked" value={asst?.failure_count ?? 0} sub="analysis only" accent="warn" tone={asst?.failure_count ? "warn" : "text-1"} />
            <StatTile label="Automation Jobs" value={auto?.job_count ?? 0} sub={`${auto?.run_count ?? 0} runs`} accent="hud" />
          </div>
        )}

        {/* 네비게이션 IA — 섹션별 항목이 기존 라우트로 연결 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P43 · UNIFIED NAVIGATION" title="Home → Research / Knowledge / Agents / System" />
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sections.map((s) => (
              <div key={s.section} className="border border-[var(--c-border)] rounded-sm overflow-hidden">
                <div className="flex items-center gap-2 px-3 h-9 bg-[var(--c-panel-2)] border-b border-[var(--c-border)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)]" />
                  <span className="text-[12px] font-semibold tracking-wide text-[var(--c-text-1)]">{s.section}</span>
                  <span className="c-num text-[10px] text-[var(--c-text-3)] ml-auto">{s.moduleCount} modules</span>
                </div>
                <div className="divide-y divide-[var(--c-border)]">
                  {s.items.map((it) => {
                    const href = itemHref(s.section, it.item);
                    return (
                      <Link key={it.item} href={href} className="flex items-center gap-3 px-3 py-2 no-underline hover:bg-[var(--c-panel-2)] transition-colors">
                        <span className="text-[12px] text-[var(--c-text-1)] w-24 shrink-0">{it.item}</span>
                        <span className="text-[10.5px] text-[var(--c-text-3)] flex-1 truncate">{itemNote(s.section, it.item)}</span>
                        <span className="c-num text-[10px] text-[var(--c-text-2)]">{it.moduleCount}</span>
                        <span className="c-num text-[9.5px] text-[var(--c-hud)] tracking-wider">{href}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3 text-[10px] text-[var(--c-text-3)]">
            {live ? "라이브" : "캐시"} · digest <span className="c-num">{meta.digest}</span> · 기존 페이지 재배치(신규 대시보드 없음, 기능 보존)
          </div>
        </Panel>

        {/* P41~P45 능력 카드 — 라이브 메트릭 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P41 – P45" title="Local Research Environment Capabilities" />
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {caps.map((c) => (
              <Link key={c.phase} href={capHref(c.phase)} className="block no-underline border border-[var(--c-border)] rounded-sm p-3 hover:bg-[var(--c-panel-2)] transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="c-num text-[9.5px] font-semibold tracking-widest text-[var(--c-hud)]">{c.phase}</span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-1)]">{c.name}</span>
                </div>
                <div className="text-[11px] text-[var(--c-text-2)] leading-relaxed">{c.summary}</div>
                <div className="mt-2 c-num text-[10px] text-[var(--c-hud)] tracking-wide">{c.metric}</div>
              </Link>
            ))}
          </div>
        </Panel>

        {/* 잠재 연구 영역(P44, 라이브) — 있을 때만 */}
        {live && asst?.potential_areas && asst.potential_areas.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="P44 · POSSIBLE NEXT REVIEW" title="Potential Research Areas (advisory)" />
            <div className="p-3 space-y-2">
              {asst.potential_areas.map((a, i) => (
                <div key={i} className="flex items-center gap-3 border-l-2 border-[var(--c-hud)] pl-3 py-1.5">
                  <span className="text-[12px] text-[var(--c-text-1)] flex-1">{a.area}</span>
                  <span className="text-[10.5px] text-[var(--c-text-3)] truncate max-w-[45%]">{a.rationale}</span>
                  <span className="c-num text-[10px] text-[var(--c-text-2)]">×{a.evidence}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* 상태 블록(로딩/에러) + 안전 고지 */}
        <StateBlock loading={loading && !data} err={live ? null : err}>
          <div />
        </StateBlock>
        <Panel className="overflow-hidden">
          <PanelHead kicker="SAFETY" title="Research Authority Only" />
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--c-text-2)] w-40 shrink-0">Nav coverage</span>
              <div className="flex-1"><Meter value={meta.coverage} tone="pos" /></div>
              <span className="c-num text-[10.5px] text-[var(--c-text-2)] w-12 text-right">{Math.round(meta.coverage * 100)}%</span>
            </div>
            <div className="text-[10.5px] text-[var(--c-text-3)] leading-relaxed">
              {data?.disclaimer ??
                "이 뷰는 백엔드 원장을 READ ONLY 로 요약한다. 분석·추천·요약만 하며 자동 거래·자동 배포·자동 자본 배분·전략 승인을 하지 않는다."}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
