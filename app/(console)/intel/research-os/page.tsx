"use client";
// Research OS — Jarvis 로컬 연구 환경(P41~P45) 라이브 통합 뷰.
// /console/research-os 폴링(30s). 백엔드 없으면 정적 매니페스트 폴백. 읽기전용 · 결정/거래/집행 없음.
import { useState } from "react";
import Link from "next/link";
import { getResearchOS, type ResearchOSGraph } from "@/lib/console-api";
import { useConsole, PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";
import {
  RESEARCH_OS_SECTIONS, RESEARCH_OS_META, RESEARCH_OS_CAPABILITIES,
  SECTION_COLOR, SECTION_ORDER, WORKSPACE_HREF, itemHref, itemNote, capHref,
} from "@/lib/research-os";

/* ── 커버리지 링 ─────────────────────────────────────── */
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

function Health({ status }: { status?: string }) {
  const tone = status === "OK" ? "var(--c-pos)" : status === "WARN" ? "var(--c-warn)" : status === "FAIL" ? "var(--c-neg)" : "var(--c-text-3)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
      <span className="c-num text-[12px] font-semibold" style={{ color: tone }}>{status ?? "—"}</span>
    </span>
  );
}

/* ── 의존성 그래프 (섹션 노드-엣지, 호버 하이라이트) ── */
const POS: Record<string, { x: number; y: number }> = {
  Research: { x: 215, y: 54 }, Knowledge: { x: 66, y: 168 },
  Agents: { x: 364, y: 168 }, System: { x: 215, y: 262 },
};
function radius(n: number) { return 15 + Math.sqrt(Math.max(0, n)) * 2.4; }

function ModuleGraph({ section, modules, moduleEdges, onBack }:
  { section: string; modules: string[]; moduleEdges: NonNullable<ResearchOSGraph["module_edges"]>; onBack: () => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const col = SECTION_COLOR[section];
  const W = 430, H = 330, cx = W / 2, cy = H / 2 + 6, R = Math.min(150, 60 + modules.length * 3);
  const pos: Record<string, { x: number; y: number }> = {};
  modules.forEach((m, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, modules.length) - Math.PI / 2;
    pos[m] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const inSet = new Set(modules);
  const intra = moduleEdges.filter((e) => inSet.has(e.source) && inSet.has(e.target));
  const outbound = moduleEdges.filter((e) => inSet.has(e.source) && !inSet.has(e.target)).length;
  const inbound = moduleEdges.filter((e) => !inSet.has(e.source) && inSet.has(e.target)).length;
  const deg: Record<string, number> = {};
  intra.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });

  return (
    <div className="relative">
      <button onClick={onBack} className="absolute top-1 left-1 z-10 flex items-center gap-1 text-[10px] text-[var(--c-text-3)] hover:text-[var(--c-hud)] bg-transparent border-0 cursor-pointer">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 2 L3.5 5 L6.5 8" /></svg>
        섹션 뷰
      </button>
      <div className="absolute top-1 right-2 z-10 text-right">
        <div className="flex items-center gap-1.5 justify-end"><span className="h-2 w-2 rounded-[2px]" style={{ background: col }} /><span className="text-[11px] font-semibold text-[var(--c-text-1)]">{section}</span></div>
        <div className="c-num text-[9.5px] text-[var(--c-text-3)]">{modules.length} modules · {intra.length} intra · {outbound + inbound} cross</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 340 }}>
        {intra.map((e, i) => {
          const a = pos[e.source], b = pos[e.target]; if (!a || !b) return null;
          const hot = hover != null && (e.source === hover || e.target === hover);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? col : "var(--c-border-2)"} strokeWidth={hot ? 1.6 : 1} strokeOpacity={hover && !hot ? 0.1 : hot ? 0.85 : 0.4} className="transition-all" />;
        })}
        {modules.map((m) => {
          const p = pos[m]; const on = !hover || m === hover || intra.some((e) => (e.source === hover && e.target === m) || (e.target === hover && e.source === m));
          const r = 3.5 + Math.min(6, (deg[m] || 0) * 1.5);
          return (
            <g key={m} onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", opacity: on ? 1 : 0.2 }} className="transition-opacity">
              <circle cx={p.x} cy={p.y} r={r} fill={deg[m] ? `color-mix(in srgb,${col} 30%,var(--c-panel))` : "var(--c-panel-2)"} stroke={col} strokeWidth={hover === m ? 2 : 1} />
              {(hover === m || modules.length <= 16) && (
                <text x={p.x} y={p.y - r - 3} textAnchor="middle" fontSize="8" fill={hover === m ? "var(--c-text-1)" : "var(--c-text-3)"} className="c-num">{m.replace(/^research_|^governance_/, "…")}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="px-2 text-[10px] text-[var(--c-text-3)]">
        원 = 모듈(크기 = 섹션 내 연결도) · 대부분 연결 없는 독립 섬 → 과잉 분할의 시각적 증거.
      </div>
    </div>
  );
}

function DepGraph({ graph, modulesBySection }:
  { graph: ResearchOSGraph; modulesBySection: Record<string, string[]> }) {
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const touches = (e: { source: string; target: string }) => !hover || e.source === hover || e.target === hover;
  const nodeActive = (id: string) => !hover || id === hover ||
    graph.edges.some((e) => (e.source === hover && e.target === id) || (e.target === hover && e.source === id));
  const hn = hover ? nodeById[hover] : null;

  if (focus) {
    return <ModuleGraph section={focus} modules={modulesBySection[focus] ?? []}
      moduleEdges={graph.module_edges ?? []} onBack={() => setFocus(null)} />;
  }

  return (
    <div className="relative">
      <svg viewBox="0 0 430 310" className="w-full" style={{ maxHeight: 320 }}>
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--c-text-3)" />
          </marker>
          <marker id="ah-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--c-hud)" />
          </marker>
        </defs>
        {/* 엣지 */}
        {graph.edges.map((e, i) => {
          const a = POS[e.source], b = POS[e.target];
          if (!a || !b) return null;
          const ra = radius(nodeById[e.source]?.moduleCount ?? 1), rb = radius(nodeById[e.target]?.moduleCount ?? 1);
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
          const x1 = a.x + (dx / L) * ra, y1 = a.y + (dy / L) * ra;
          const x2 = b.x - (dx / L) * (rb + 6), y2 = b.y - (dy / L) * (rb + 6);
          const hot = hover != null && touches(e);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={hot ? "var(--c-hud)" : "var(--c-border-2)"}
              strokeWidth={1.2 + e.weight * 0.55} strokeOpacity={hover && !hot ? 0.12 : hot ? 0.9 : 0.5}
              markerEnd={hot ? "url(#ah-hot)" : "url(#ah)"} className="transition-all duration-150" />
          );
        })}
        {/* 노드 */}
        {graph.nodes.map((n) => {
          const p = POS[n.id]; if (!p) return null;
          const r = radius(n.moduleCount), col = SECTION_COLOR[n.id], on = nodeActive(n.id);
          return (
            <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={() => setFocus(n.id)}
              style={{ cursor: "pointer", opacity: on ? 1 : 0.28 }} className="transition-opacity duration-150">
              <circle cx={p.x} cy={p.y} r={r} fill={`color-mix(in srgb, ${col} 16%, var(--c-panel))`}
                stroke={col} strokeWidth={hover === n.id ? 2.4 : 1.4}
                style={{ filter: hover === n.id ? `drop-shadow(0 0 8px color-mix(in srgb,${col} 60%,transparent))` : "none" }} />
              <text x={p.x} y={p.y - 1} textAnchor="middle" className="c-num" fontSize="13" fontWeight="600" fill="var(--c-text-1)">{n.moduleCount}</text>
              <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="8.5" fill={col} style={{ letterSpacing: "0.05em" }}>{n.id}</text>
              {n.internal > 0 && (
                <text x={p.x + r - 2} y={p.y - r + 6} textAnchor="start" className="c-num" fontSize="8.5" fill="var(--c-text-3)">↻{n.internal}</text>
              )}
            </g>
          );
        })}
      </svg>
      {/* 호버 툴팁 */}
      <div className="absolute top-2 right-2 min-w-[140px] pointer-events-none transition-opacity"
        style={{ opacity: hn ? 1 : 0 }}>
        {hn && (
          <div className="bg-[var(--c-panel-2)] border border-[var(--c-border-2)] rounded-sm px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: SECTION_COLOR[hn.id] }} />
              <span className="text-[11px] font-semibold text-[var(--c-text-1)]">{hn.id}</span>
            </div>
            <div className="c-num text-[10px] text-[var(--c-text-2)]">{hn.moduleCount} modules · {hn.internal} internal deps</div>
            <div className="c-num text-[9.5px] text-[var(--c-text-3)] mt-0.5">
              {graph.edges.filter((e) => e.source === hn.id).map((e) => `→${e.target}(${e.weight})`).join(" ") || "no outbound"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResearchOS() {
  const { data, err, loading } = useConsole(getResearchOS, [], 30000);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const live = !!data;
  const meta = data?.meta ?? {
    section_count: RESEARCH_OS_META.sectionCount, item_count: RESEARCH_OS_META.itemCount,
    module_count: RESEARCH_OS_META.moduleCount, coverage: RESEARCH_OS_META.coverage,
    duplicate_families: RESEARCH_OS_META.duplicateFamilies, digest: RESEARCH_OS_META.digest,
  };
  const sections = (data?.sections ?? RESEARCH_OS_SECTIONS.map((s) => ({
    section: s.section, moduleCount: s.moduleCount,
    items: s.items.map((i) => ({ item: i.item, moduleCount: i.moduleCount, modules: [] as string[] })),
  }))).slice().sort((a, b) => SECTION_ORDER.indexOf(a.section as never) - SECTION_ORDER.indexOf(b.section as never));
  const caps = data?.capabilities ?? RESEARCH_OS_CAPABILITIES.map((c) => ({
    phase: c.phase, name: c.name, summary: c.summary, metric: c.live ? "LINKED" : "BACKEND",
  }));
  const rt = data?.runtime, asst = data?.assistant, auto = data?.automation, graph = data?.graph;
  const totalModules = sections.reduce((n, s) => n + s.moduleCount, 0) || 1;
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
        {/* HERO */}
        <div className="panel-hud rounded-sm p-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-center">
          <Ring value={meta.coverage} label={`${meta.module_count} modules mapped`}
            sub={`${meta.section_count} sections · ${meta.item_count} nav items · ${meta.duplicate_families} consolidation candidates`} />
          <div className="min-w-0">
            <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-text-3)] uppercase mb-2">Module Distribution</div>
            <div className="flex w-full h-9 rounded-sm overflow-hidden bg-[var(--c-panel-3)]">
              {sections.map((s, i) => (
                <Link key={s.section} href={itemHref(s.section, s.items[0]?.item ?? "")}
                  title={`${s.section} · ${s.moduleCount} modules (${Math.round((s.moduleCount / totalModules) * 100)}%)`}
                  className="relative h-full flex items-center justify-center no-underline transition-opacity hover:opacity-80"
                  style={{ width: `${(s.moduleCount / totalModules) * 100}%`, background: `color-mix(in srgb, ${SECTION_COLOR[s.section]} 82%, transparent)`, marginLeft: i ? 2 : 0 }}>
                  {s.moduleCount / totalModules > 0.06 && <span className="c-num text-[11px] font-semibold text-[var(--c-bg)]">{s.moduleCount}</span>}
                </Link>
              ))}
            </div>
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

        {/* 헌장 6워크스페이스 (C4) */}
        {data?.workspaces && data.workspaces.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="C4 · CONSTITUTION IA" title="Six Workspaces"
              right={<span className="text-[9px] text-[var(--c-text-3)]">Home · Research · Experiments · Knowledge · Assistant · System</span>} />
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {data.workspaces.map((w) => (
                <Link key={w.workspace} href={WORKSPACE_HREF[w.workspace] ?? "/command"}
                  className="no-underline border border-[var(--c-border)] rounded-sm p-2.5 hover:border-[color-mix(in_srgb,var(--c-hud)_40%,var(--c-border))] hover:bg-[var(--c-panel-2)] transition-colors">
                  <div className="text-[12px] font-semibold text-[var(--c-text-1)]">{w.workspace}</div>
                  <div className="c-num text-[18px] text-[var(--c-hud)] leading-none mt-1">{w.moduleCount}</div>
                  <div className="text-[9px] text-[var(--c-text-3)] mt-1 leading-snug line-clamp-2">{w.description}</div>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        {/* 라이브 상태 스트립 */}
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

        {/* 아키텍처 맵(드릴다운) + 카테고리 분포 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4">
          <Panel className="overflow-hidden">
            <PanelHead kicker="P43 · UNIFIED NAVIGATION" title="Home → Research / Knowledge / Agents / System"
              right={<span className="text-[9px] text-[var(--c-text-3)] tracking-wider">클릭 → 모듈 펼치기</span>} />
            <div className="p-3.5 space-y-3">
              {sections.map((s) => {
                const smax = Math.max(...s.items.map((i) => i.moduleCount), 1);
                const col = SECTION_COLOR[s.section];
                const open = openSection === s.section;
                const mods = s.items.flatMap((i) => i.modules ?? []);
                return (
                  <div key={s.section}>
                    <button onClick={() => setOpenSection(open ? null : s.section)}
                      className="w-full flex items-center gap-2 mb-1.5 bg-transparent border-0 cursor-pointer px-0 group">
                      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: col }} />
                      <span className="text-[12px] font-semibold text-[var(--c-text-1)]">{s.section}</span>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="var(--c-text-3)" strokeWidth="1.5" strokeLinecap="round"
                        className={`transition-transform ${open ? "rotate-90" : ""}`}><path d="M3.5 2 L6.5 5 L3.5 8" /></svg>
                      <span className="c-num text-[10px] text-[var(--c-text-3)] ml-auto">{s.moduleCount} modules</span>
                    </button>
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
                    {open && mods.length > 0 && (
                      <div className="pl-4 mt-2 flex flex-wrap gap-1">
                        {mods.map((m) => (
                          <span key={m} className="c-num text-[9.5px] px-1.5 py-0.5 rounded-[2px] text-[var(--c-text-2)]"
                            style={{ background: `color-mix(in srgb, ${col} 10%, var(--c-panel-2))`, border: `1px solid color-mix(in srgb, ${col} 25%, var(--c-border))` }}>{m}</span>
                        ))}
                      </div>
                    )}
                    {open && mods.length === 0 && (
                      <div className="pl-4 mt-1 text-[10px] text-[var(--c-text-3)]">모듈 목록은 라이브 백엔드에서 제공됩니다.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead kicker="P41 · AUDIT" title="Module Category Distribution" />
            <div className="p-4 space-y-2">
              {cats.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">감사 데이터 없음(정적 폴백)</div>}
              {cats.map(([c, n]) => (
                <div key={c} title={`${c}: ${n} modules`} className="grid grid-cols-[104px_1fr_28px] items-center gap-2.5">
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

        {/* 의존성 그래프 (라이브) */}
        {live && graph && graph.nodes && graph.nodes.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHead kicker="P41 · DEPENDENCY GRAPH" title="Cross-Section Import Dependencies"
              right={<span className="c-num text-[9px] text-[var(--c-text-3)]">{graph.edge_total} edges · 호버·클릭</span>} />
            <div className="p-3">
              <DepGraph graph={graph}
                modulesBySection={Object.fromEntries(sections.map((s) => [s.section, s.items.flatMap((i) => i.modules ?? [])]))} />
              <div className="px-2 pb-1 text-[10px] text-[var(--c-text-3)] leading-relaxed">
                노드 크기 = 모듈 수 · 화살표 = import 방향(굵기 = 빈도) · ↻ = 섹션 내부 의존.
                계층은 원장 파일로 주로 결합돼 코드 import 는 희소합니다(의도된 느슨한 결합).
              </div>
            </div>
          </Panel>
        )}

        {/* 파이프라인 */}
        <Panel className="overflow-hidden">
          <PanelHead kicker="P41 → P45" title="Local Research Environment Pipeline" />
          <div className="p-4 pt-5">
            <div className="relative grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="hidden md:block absolute top-[14px] left-[10%] right-[10%] h-px bg-[var(--c-border-2)]" />
              {caps.map((c) => (
                <Link key={c.phase} href={capHref(c.phase)} className="relative no-underline group flex flex-col items-center text-center">
                  <span className="relative z-10 h-7 w-7 rounded-full flex items-center justify-center c-num text-[9.5px] font-semibold text-[var(--c-bg)] mb-2 transition-transform group-hover:scale-110"
                    style={{ background: "var(--c-hud)", boxShadow: "0 0 10px color-mix(in srgb,var(--c-hud) 55%,transparent)" }}>{c.phase.replace("P", "")}</span>
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

        {/* 잠재 영역(P44) */}
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
