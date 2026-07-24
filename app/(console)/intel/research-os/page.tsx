"use client";
// Research OS — Jarvis 로컬 연구 환경(P41~P45) 라이브 통합 뷰.
// /console/research-os 폴링(30s). 백엔드 없으면 정적 매니페스트로 폴백. 읽기전용 · 결정/거래/집행 없음.
import Link from "next/link";
import { getResearchOS } from "@/lib/console-api";
import { useConsole, PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";
import {
  RESEARCH_OS_SECTIONS, RESEARCH_OS_META, RESEARCH_OS_CAPABILITIES,
  SECTION_COLOR, SECTION_ORDER, itemHref, itemNote, capHref,
} from "@/lib/research-os";

/* ── 링 게이지 (coverage %) ─────────────────────────────── */
function Ring({ value, label, sub }: { value: number; label: string; sub: string }) {
  const R = 46, C = 2 * Math.PI * R, pct = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 116, height: 116 }}>
        <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90">
          <circle cx="58" cy="58" r={R} fill="none" stroke="var(--c-panel-3)" strokeWidth="8" />
          <circle cx="58" cy="58" r={R} fill="none" stroke="var(--c-hud)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb,var(--c-hud) 60%,transparent))" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="c-num text-[26px] font-semibold text-[var(--c-hud)] leading-none">{Math.round(pct * 100)}<span className="text-[13px]">%</span></span>
          <span className="text-[8.5px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mt-1">coverage</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--c-text-1)]">{label}</div>
        <div className="text-[11px] text-[var(--c-text-2)] mt-1 leading-relaxed">{sub}</div>
      </div>
    </div>
  );
}

/* ── 상태 점 ─────────────────────────────────────────── */
function Health({ status }: { status?: string }) {
  const tone = status === "OK" ? "var(--c-pos)" : status === "WARN" ? "var(--c-warn)" : status === "FAIL" ? "var(--c-neg)" : "var(--c-text-3)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
      <span className="c-num text-[12px] font-semibold" style={{ color: tone }}>{status ?? "—"}</span>
    </span>
  );
}

export default function ResearchOS() {
  const { data, err, loading } = useConsole(getResearchOS, [], 30000);
  const live = !!data;
  const meta = data?.meta ?? {
    section_count: RESEARCH_OS_META.sectionCount, item_count: RESEARCH_OS_META.itemCount,
    module_count: RESEARCH_OS_META.moduleCount, coverage: RESEARCH_OS_META.coverage,
    duplicate_families: RESEARCH_OS_META.duplicateFamilies, digest: RESEARCH_OS_META.digest,
  };
  const sections = (data?.sections ?? RESEARCH_OS_SECTIONS.map((s) => ({
    section: s.section, moduleCount: s.moduleCount,
    items: s.items.map((i) => ({ item: i.item, moduleCount: i.moduleCount })),
  }))).slice().sort((a, b) => SECTION_ORDER.indexOf(a.section as never) - SECTION_ORDER.indexOf(b.section as never));
  const caps = data?.capabilities ?? RESEARCH_OS_CAPABILITIES.map((c) => ({
    phase: c.phase, name: c.name, summary: c.summary, metric: c.live ? "LINKED" : "BACKEND",
  }));
  const rt = data?.runtime, asst = data?.assistant, auto = data?.automation;
  const totalModules = sections.reduce((n, s) => n + s.moduleCount, 0) || 1;

  // 카테고리 분포(감사) — 크기순
  const cats = Object.entries(data?.audit?.category_distribution ?? {}).sort((a, b) => b[1] - a[1]);
  const catMax = cats.length ? cats[0][1] : 1;

  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Research OS · Local Research Environment"
        right={<>
          <Badge tone={live ? "pos" : "mute"}>{live ? "● LIVE" : loading ? "…" : "CACHED"}</Badge>
          <Badge tone="hud">READ ONLY · NO EXECUTION</Badge>
        </>} />

      <div className="p-5 space-y-4 max-w-[1180px]">
        {/* ── HERO: 커버리지 링 + 모듈 분포 맵 ── */}
        <div className="panel-hud rounded-sm p-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-center">
          <Ring value={meta.coverage} label={`${meta.module_count} modules mapped`}
            sub={`${meta.section_count} sections · ${meta.item_count} nav items · ${meta.duplicate_families} consolidation candidates`} />
          <div className="min-w-0">
            <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-text-3)] uppercase mb-2">Module Distribution</div>
            {/* 스택 분포 바 */}
            <div className="flex w-full h-9 rounded-sm overflow-hidden bg-[var(--c-panel-3)]">
              {sections.map((s, i) => (
                <Link key={s.section} href={itemHref(s.section, s.items[0]?.item ?? "")} title={`${s.section} · ${s.moduleCount}`}
                  className="relative h-full flex items-center justify-center no-underline transition-opacity hover:opacity-80"
                  style={{ width: `${(s.moduleCount / totalModules) * 100}%`, background: `color-mix(in srgb, ${SECTION_COLOR[s.section]} 82%, transparent)`, marginLeft: i ? 2 : 0 }}>
                  {s.moduleCount / totalModules > 0.06 && (
                    <span className="c-num text-[11px] font-semibold text-[var(--c-bg)]">{s.moduleCount}</span>
                  )}
                </Link>
              ))}
            </div>
            {/* 레전드 */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
              {sections.map((s) => (
                <span key={s.section} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: SECTION_COLOR[s.section] }} />
                  <span className="text-[11px] text-[var(--c-text-1)]">{s.section}</span>
                  <span className="c-num text-[10px] text-[var(--c-text-3)]">{Math.round((s.moduleCount / totalModules) * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 라이브 상태 스트립 ── */}
        {live && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="panel rounded-sm px-4 py-3 flex items-center justify-between">
              <span className="text-[9.5px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">Runtime Health</span>
              <Health status={rt?.health_status} />
            </div>
            {[
              { k: "Assistant Records", v: asst?.total_records ?? 0, s: `${asst?.active_sources ?? 0} sources` },
              { k: "Failures Tracked", v: asst?.failure_count ?? 0, s: "analysis only" },
              { k: "Automation Jobs", v: auto?.job_count ?? 0, s: `${auto?.run_count ?? 0} runs` },
            ].map((x) => (
              <div key={x.k} className="panel rounded-sm px-4 py-3">
                <div className="text-[9.5px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">{x.k}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="c-num text-[20px] font-semibold text-[var(--c-text-1)] leading-none">{x.v}</span>
                  <span className="text-[10px] text-[var(--c-text-3)]">{x.s}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 아키텍처 맵 + 카테고리 분포 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4">
          {/* 섹션 → 항목(비례 바) */}
          <Panel className="overflow-hidden">
            <PanelHead kicker="P43 · UNIFIED NAVIGATION" title="Home → Research / Knowledge / Agents / System" />
            <div className="p-3.5 space-y-3.5">
              {sections.map((s) => {
                const smax = Math.max(...s.items.map((i) => i.moduleCount), 1);
                const col = SECTION_COLOR[s.section];
                return (
                  <div key={s.section}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: col }} />
                      <span className="text-[12px] font-semibold text-[var(--c-text-1)]">{s.section}</span>
                      <span className="c-num text-[10px] text-[var(--c-text-3)] ml-auto">{s.moduleCount} modules</span>
                    </div>
                    <div className="space-y-1 pl-4">
                      {s.items.map((it) => {
                        const href = itemHref(s.section, it.item);
                        return (
                          <Link key={it.item} href={href} title={`${it.item} · ${itemNote(s.section, it.item)} → ${href}`}
                            className="group grid grid-cols-[84px_1fr_auto] items-center gap-2.5 no-underline">
                            <span className="text-[11.5px] text-[var(--c-text-2)] group-hover:text-[var(--c-text-1)] truncate">{it.item}</span>
                            <span className="relative h-4 bg-[var(--c-panel-3)] rounded-[2px] overflow-hidden">
                              <span className="absolute left-0 top-0 bottom-0 rounded-[2px] transition-[width]"
                                style={{ width: `${Math.max(3, (it.moduleCount / smax) * 100)}%`, background: `color-mix(in srgb, ${col} 45%, transparent)`, borderRight: `2px solid ${col}` }} />
                            </span>
                            <span className="grid grid-cols-[20px_150px] items-center gap-2">
                              <span className="c-num text-[11px] text-[var(--c-text-1)] text-right">{it.moduleCount}</span>
                              <span className="text-[10px] text-[var(--c-text-3)] group-hover:text-[var(--c-text-2)] truncate transition-colors">{itemNote(s.section, it.item)}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* 카테고리 분포(감사) */}
          <Panel className="overflow-hidden">
            <PanelHead kicker="P41 · AUDIT" title="Module Category Distribution" />
            <div className="p-4 space-y-2">
              {cats.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">감사 데이터 없음(정적 폴백)</div>}
              {cats.map(([c, n]) => (
                <div key={c} className="grid grid-cols-[104px_1fr_28px] items-center gap-2.5">
                  <span className="text-[11px] text-[var(--c-text-2)] truncate">{c}</span>
                  <span className="h-2.5 bg-[var(--c-panel-3)] rounded-[2px] overflow-hidden">
                    <span className="block h-full rounded-[2px]" style={{ width: `${(n / catMax) * 100}%`, background: "var(--c-hud)" }} />
                  </span>
                  <span className="c-num text-[10.5px] text-[var(--c-text-1)] text-right">{n}</span>
                </div>
              ))}
              <div className="pt-2 text-[10px] text-[var(--c-text-3)]">
                {live ? "라이브" : "캐시"} · dup families <span className="c-num text-[var(--c-warn)]">{meta.duplicate_families}</span> · digest <span className="c-num">{meta.digest}</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* ── P41→P45 파이프라인 ── */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P41 → P45" title="Local Research Environment Pipeline" />
          <div className="p-4 pt-5">
            <div className="relative grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* 커넥터 라인 */}
              <div className="hidden md:block absolute top-[14px] left-[10%] right-[10%] h-px bg-[var(--c-border-2)]" />
              {caps.map((c) => (
                <Link key={c.phase} href={capHref(c.phase)}
                  className="relative no-underline group flex flex-col items-center text-center">
                  <span className="relative z-10 h-7 w-7 rounded-full flex items-center justify-center c-num text-[9.5px] font-semibold text-[var(--c-bg)] mb-2 transition-transform group-hover:scale-110"
                    style={{ background: "var(--c-hud)", boxShadow: "0 0 10px color-mix(in srgb,var(--c-hud) 55%,transparent)" }}>
                    {c.phase.replace("P", "")}
                  </span>
                  <div className="w-full border border-[var(--c-border)] rounded-sm p-2.5 bg-[var(--c-panel)] group-hover:border-[color-mix(in_srgb,var(--c-hud)_40%,var(--c-border))] transition-colors">
                    <div className="text-[11.5px] font-semibold text-[var(--c-text-1)] leading-tight">{c.name}</div>
                    <div className="mt-1 text-[9.5px] text-[var(--c-text-3)] leading-snug min-h-[42px]">{c.summary}</div>
                    <div className="mt-1.5 c-num text-[9.5px] text-[var(--c-hud)] tracking-wide">{c.metric}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        {/* ── 잠재 영역(P44, 라이브) ── */}
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

        {/* ── 상태/안전 ── */}
        {!live && (loading || err) && (
          <div className="text-[10.5px] text-[var(--c-text-3)] px-1">
            {loading ? "백엔드 /console/research-os 연결 중… (정적 매니페스트 표시 중)" : `백엔드 오프라인 — 정적 매니페스트 표시 중 (${err})`}
          </div>
        )}
        <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed px-1 pb-2">
          {data?.disclaimer ??
            "Research OS — READ ONLY. 분석·추천·요약만 하며 자동 거래·자동 배포·자동 자본 배분·전략 승인을 하지 않는다. P44 assistant analyzes · P45 automation = workflow assistance."}
        </div>
      </div>
    </div>
  );
}
