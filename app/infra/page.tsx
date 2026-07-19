"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  getKnowledgeGraph, resetKnowledgeGraph, triggerAiUpdate, getGraphUpdateStatus,
  getPaperState, resetPaperState, closePaperPosition, getGraphNodeHistory,
  type KnowledgeGraph, type GraphNode, type GraphEdge, type GraphUpdateStatus,
  type PaperState, type PaperPosition, type GraphHistoryPoint,
} from "@/lib/api";
import { TOKEN, categoricalColor } from "@/lib/chart-colors";

// ── 색상 시스템 ───────────────────────────────────────────────────────────────
const SECTOR_COLOR: Record<string, string> = {
  hbm_memory:   categoricalColor(0),   // 메모리
  foundry:      categoricalColor(1),   // 파운드리
  equipment:    categoricalColor(2),   // 장비
  gpu_demand:   categoricalColor(3),   // GPU
  power_infra:  categoricalColor(4),   // 전력
  datacenter:   categoricalColor(5),   // 데이터센터
  cooling:      categoricalColor(6),   // 냉각
  ai_demand:    categoricalColor(7),   // AI 수요
  regulation:   categoricalColor(8),   // 규제
};
const TYPE_SHAPE: Record<string, string> = {
  company:    "circle",
  policy:     "diamond",
  resource:   "rect",
  technology: "triangle",
};
function sectorColor(s: string) { return SECTOR_COLOR[s] ?? TOKEN.text3; }

// ── 시계열 스파크라인 (#2 추세) ────────────────────────────────────────────────
function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ── D3 시뮬레이션 노드/링크 타입 ──────────────────────────────────────────────
interface SimNode extends d3.SimulationNodeDatum, GraphNode { r: number; }
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  data: GraphEdge;
  sourceId: string; targetId: string;
}

// ── 섹터 레이블 ──────────────────────────────────────────────────────────────
const SECTOR_LABEL: Record<string, string> = {
  hbm_memory: "HBM·메모리", foundry: "파운드리", equipment: "장비",
  gpu_demand: "GPU", power_infra: "전력 인프라", datacenter: "데이터센터",
  cooling: "냉각", ai_demand: "AI 수요처", regulation: "정책·규제",
};

// ── 관계 레이블 ──────────────────────────────────────────────────────────────
const RELATION_LABEL: Record<string, string> = {
  supplies: "공급", depends_on: "의존", manufactures: "제조",
  operated_by: "운영", constrains: "제약", incentivizes: "지원",
  regulates: "규제", competes: "경쟁",
};

// ── 데이터 출처 레이블/색상 (#7 신선도·신뢰도) ────────────────────────────────
const SOURCE_LABEL: Record<string, string> = {
  disclosure: "공시", news: "뉴스", analyst_estimate: "애널리스트 추정", ai_estimate: "AI 추정",
};
const SOURCE_COLOR: Record<string, string> = {
  disclosure: TOKEN.pos, news: TOKEN.info, analyst_estimate: TOKEN.warn, ai_estimate: TOKEN.text3,
};

export default function InfraGraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filterSector, setFilterSector] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [aiUpdating, setAiUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<GraphUpdateStatus | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [paperResetting, setPaperResetting] = useState(false);
  const [history, setHistory] = useState<GraphHistoryPoint[]>([]);
  const historyCtrl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await getKnowledgeGraph();
      setGraph(g);
      setLastUpdate(new Date(g.meta.last_updated).toLocaleString("ko-KR"));
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  // 페이퍼 트레이딩 폴링 (30초)
  useEffect(() => {
    const poll = () => getPaperState().then(setPaper).catch(() => {});
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, []);

  // 선택 노드 시계열 (#2 추세) 로드
  useEffect(() => {
    historyCtrl.current?.abort();
    if (!selected) { setHistory([]); return; }
    const c = new AbortController(); historyCtrl.current = c;
    getGraphNodeHistory(selected.id, c.signal)
      .then(r => { if (!c.signal.aborted) setHistory(r.history); })
      .catch(e => { if (!c.signal.aborted && e?.name !== "AbortError") setHistory([]); });
    return () => c.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // 업데이트 상태 폴링 (running 중이면 5초, 아니면 30초)
  useEffect(() => {
    const poll = () => getGraphUpdateStatus().then(s => {
      setUpdateStatus(s);
      if (s.running) load(); // 완료 시 그래프 즉시 갱신
    }).catch(() => {});
    poll();
    const iv = setInterval(poll, updateStatus?.running ? 5_000 : 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStatus?.running]);

  // ── D3 그래프 렌더링 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!graph || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = svgRef.current.clientWidth || 900;
    const H = svgRef.current.clientHeight || 600;

    // 필터 적용
    const visNodes = filterSector
      ? graph.nodes.filter(n => n.sector === filterSector)
      : graph.nodes;
    const visIds = new Set(visNodes.map(n => n.id));
    const visEdges = graph.edges.filter(e => visIds.has(e.source) && visIds.has(e.target));

    // 시뮬레이션 노드/링크 준비
    const nodes: SimNode[] = visNodes.map(n => ({
      ...n,
      label: n.label ?? n.id,
      sector: n.sector ?? "",
      r: 10 + n.bottleneck_score * 22,
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2 + (Math.random() - 0.5) * 200,
    }));
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const links: SimLink[] = visEdges
      .map(e => ({ sourceId: e.source, targetId: e.target, data: e,
        source: nodeById.get(e.source)!, target: nodeById.get(e.target)! }))
      .filter(l => l.source && l.target);

    // 줌
    const g = svg.append("g");
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", ev => g.attr("transform", ev.transform)) as never);

    // 화살표 마커
    const defs = svg.append("defs");
    ["normal", "bottleneck"].forEach(kind => {
      defs.append("marker")
        .attr("id", `arrow-${kind}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18).attr("refY", 0)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", kind === "bottleneck" ? TOKEN.neg : TOKEN.text3);
    });

    // 링크 — 경쟁(#4) 엣지는 무방향(화살표 없음)·회색 점선으로 공급 엣지와 구분
    const link = g.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", l => l.data.relation_category === "competition" ? `${TOKEN.text3}70` : l.data.bottleneck ? `${TOKEN.neg}60` : `${TOKEN.border}80`)
      .attr("stroke-width", l => l.data.relation_category === "competition" ? 1 : 1 + l.data.weight * 2.5)
      .attr("stroke-dasharray", l => l.data.relation_category === "competition" ? "2 3" : l.data.bottleneck ? "none" : "4 3")
      .attr("marker-end", l => l.data.relation_category === "competition" ? null : `url(#arrow-${l.data.bottleneck ? "bottleneck" : "normal"})`);

    // 링크 레이블
    const linkLabel = g.append("g").selectAll("text").data(links).join("text")
      .attr("font-size", 9).attr("fill", TOKEN.text3).attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .text(l => RELATION_LABEL[l.data.relation] ?? l.data.relation);

    // 노드 그룹
    const node = g.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, SimNode>()
        .on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on("end", (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) as never)
      .on("click", (_, d) => setSelected(prev => prev?.id === d.id ? null : d));

    // 병목 글로우 링
    node.filter(d => d.bottleneck_score > 0.7)
      .append("circle")
      .attr("r", d => d.r + 6)
      .attr("fill", "none")
      .attr("stroke", d => sectorColor(d.sector))
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.35);

    // 노드 원
    node.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => sectorColor(d.sector) + "33")
      .attr("stroke", d => sectorColor(d.sector))
      .attr("stroke-width", d => d.type === "policy" ? 2 : 1.5);

    // 병목 점수 게이지 (원호)
    node.filter(d => d.bottleneck_score > 0).each(function(d) {
      const arc = d3.arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(d.r - 3).outerRadius(d.r)
        .startAngle(0).endAngle(d.bottleneck_score * 2 * Math.PI);
      d3.select(this).append("path")
        .attr("d", arc({ startAngle: 0, endAngle: d.bottleneck_score * 2 * Math.PI }))
        .attr("fill", d.bottleneck_score > 0.7 ? TOKEN.neg : sectorColor(d.sector))
        .attr("opacity", 0.8);
    });

    // 아이콘 이니셜
    node.append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("font-size", d => Math.max(8, d.r * 0.55))
      .attr("fill", d => sectorColor(d.sector))
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .text(d => d.label.slice(0, d.r > 20 ? 3 : 2));

    // 노드 레이블
    node.append("text")
      .attr("y", d => d.r + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", TOKEN.text2)
      .attr("pointer-events", "none")
      .text(d => d.label);

    // Force 시뮬레이션
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(l => 80 + (1 - l.data.weight) * 80))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius(d => d.r + 20))
      .on("tick", () => {
        link
          .attr("x1", l => (l.source as SimNode).x!)
          .attr("y1", l => (l.source as SimNode).y!)
          .attr("x2", l => (l.target as SimNode).x!)
          .attr("y2", l => (l.target as SimNode).y!);
        linkLabel
          .attr("x", l => ((l.source as SimNode).x! + (l.target as SimNode).x!) / 2)
          .attr("y", l => ((l.source as SimNode).y! + (l.target as SimNode).y!) / 2 - 4);
        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

    simRef.current = sim as never;
    return () => { sim.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, filterSector]);

  const sectors = graph ? [...new Set(graph.nodes.map(n => String(n.sector ?? "")).filter(Boolean))] : [];

  async function handleReset() {
    setResetting(true);
    try { await resetKnowledgeGraph(); await load(); } finally { setResetting(false); }
  }

  async function handleAiUpdate() {
    setAiUpdating(true);
    try { await triggerAiUpdate(); } finally { setAiUpdating(false); }
  }

  async function handlePaperReset() {
    setPaperResetting(true);
    try { const s = await resetPaperState(); setPaper(s); } finally { setPaperResetting(false); }
  }

  async function handleClosePosition(nodeId: string) {
    await closePaperPosition(nodeId);
    getPaperState().then(setPaper).catch(() => {});
  }

  const paperPnl = paper
    ? paper.closed.reduce((s, c) => s + c.pnl, 0)
    : 0;
  const paperPositionsValue = paper
    ? paper.positions.reduce((s, p) => s + p.value, 0)
    : 0;

  const bottleneckNodes = graph?.nodes
    .filter(n => n.bottleneck_score > 0.7)
    .sort((a, b) => b.bottleneck_score - a.bottleneck_score) ?? [];

  return (
    <div className="flex flex-col h-full bg-bg overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-text-1 font-semibold text-sm">
            <span className="text-accent">Living</span> Knowledge Graph
            <span className="text-text-3 text-xs ml-2 font-normal">AI 인프라 공급망 · 자동 업데이트</span>
          </h1>
          {lastUpdate && <p className="text-text-3 text-[10px] mt-0.5">마지막 업데이트: {lastUpdate} · 업데이트 #{graph?.meta.update_count ?? 0}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* AI 업데이트 버튼 */}
          <div className="relative">
            <button onClick={() => setShowLog(v => !v)}
              className="text-[11px] px-2 py-1 rounded border border-border text-text-3 hover:text-text-1 flex items-center gap-1">
              로그 {updateStatus ? `#${updateStatus.update_count}` : ""}
              {showLog ? " ▲" : " ▼"}
            </button>
            {showLog && updateStatus && (
              <div className="fixed right-4 top-[52px] z-50 w-80 bg-panel border border-border rounded-lg shadow-xl p-3 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-3 uppercase tracking-wider text-[10px]">업데이트 로그</span>
                  <span className={`text-[10px] ${updateStatus.running ? "text-warn animate-pulse" : "text-text-3"}`}>
                    {updateStatus.running ? "🤖 AI 분석 중…" : "대기"}
                  </span>
                </div>
                {updateStatus.recent_log.length === 0 && (
                  <p className="text-text-3">아직 AI 업데이트 없음.</p>
                )}
                {updateStatus.recent_log.map((l, i) => (
                  <div key={i} className="border-b border-border pb-1.5">
                    <p className="text-text-3 text-[9px]">{new Date(l.ts).toLocaleString("ko-KR")}</p>
                    <p className="text-text-2">{l.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAiUpdate}
            disabled={aiUpdating || updateStatus?.running}
            className="text-[11px] px-3 py-1 rounded border border-info/40 text-info hover:bg-info/10 disabled:opacity-40 flex items-center gap-1">
            {(aiUpdating || updateStatus?.running) ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />AI 분석 중…</>
            ) : "🤖 AI 업데이트"}
          </button>
          <button onClick={handleReset} disabled={resetting}
            className="text-[11px] px-3 py-1 rounded border border-border text-text-3 hover:text-text-1 hover:border-text-3 disabled:opacity-40">
            {resetting ? "초기화 중…" : "시드 초기화"}
          </button>
          <div className="w-2 h-2 rounded-full bg-pos animate-pulse" title="라이브" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* 좌측 필터 + 병목 랭킹 */}
        <div className="w-52 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          {/* 섹터 필터 */}
          <div className="p-3 border-b border-border">
            <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">섹터 필터</p>
            <button onClick={() => setFilterSector(null)}
              className={`w-full text-left text-[11px] px-2 py-1 rounded mb-1 ${!filterSector ? "bg-accent/15 text-accent" : "text-text-3 hover:text-text-2"}`}>
              전체 보기
            </button>
            {sectors.map(s => (
              <button key={s} onClick={() => setFilterSector(s === filterSector ? null : s)}
                className={`w-full text-left text-[11px] px-2 py-1 rounded flex items-center gap-2 ${filterSector === s ? "bg-panel-2 text-text-1" : "text-text-3 hover:text-text-2"}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sectorColor(s) }} />
                {SECTOR_LABEL[s] ?? s}
              </button>
            ))}
          </div>

          {/* 병목 TOP 랭킹 */}
          <div className="p-3 flex-1">
            <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">병목 TOP</p>
            {bottleneckNodes.slice(0, 8).map(n => (
              <button key={n.id} onClick={() => setSelected(prev => prev?.id === n.id ? null : n)}
                className={`w-full text-left mb-1.5 px-2 py-1.5 rounded border text-[11px] transition-colors ${selected?.id === n.id ? "border-accent/50 bg-accent/5" : "border-border hover:border-text-3"}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-text-1 font-medium truncate">{n.label}</span>
                  <span className="text-neg font-data text-[10px] shrink-0">{(n.bottleneck_score * 100).toFixed(0)}</span>
                </div>
                <div className="h-1 mt-1 rounded-full bg-panel-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${n.bottleneck_score * 100}%`, background: n.bottleneck_score > 0.85 ? TOKEN.neg : n.bottleneck_score > 0.7 ? TOKEN.accent : TOKEN.warn }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 메인 그래프 캔버스 */}
        <div className="flex-1 relative min-w-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-text-3 text-sm">
              그래프 로딩 중…
            </div>
          )}
          <svg ref={svgRef} className="w-full h-full" />

          {/* 범례 */}
          <div className="absolute bottom-3 left-3 bg-panel/90 border border-border rounded-lg p-2.5 text-[10px] space-y-1">
            <p className="text-text-3 uppercase tracking-wider mb-1.5">범례</p>
            {Object.entries(SECTOR_LABEL).map(([s, l]) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sectorColor(s) }} />
                <span className="text-text-3">{l}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1 mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5"><span className="text-neg">─</span><span className="text-text-3">병목 엣지</span></div>
              <div className="flex items-center gap-1.5"><span className="text-text-3">- -</span><span className="text-text-3">일반 엣지</span></div>
              <div className="flex items-center gap-1.5"><span className="text-text-3">···</span><span className="text-text-3">경쟁 관계(무방향)</span></div>
              <div className="flex items-center gap-1.5"><span className="text-text-3 font-data">원 크기</span><span className="text-text-3">= 병목 스코어</span></div>
            </div>
          </div>
        </div>

        {/* 우측 노드 상세 패널 */}
        {selected && (
          <div className="w-64 shrink-0 border-l border-border overflow-y-auto p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-text-1 font-semibold text-sm">{selected.label}</h2>
                <p className="text-text-3 text-[10px] mt-0.5">{selected.country} · {SECTOR_LABEL[selected.sector] ?? selected.sector}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-text-3 hover:text-text-1 text-lg leading-none">×</button>
            </div>

            {/* 데이터 출처/신뢰도 (#7) — AI 추정치 vs 확인된 사실 구분 */}
            {selected.source && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded" style={{ background: (SOURCE_COLOR[selected.source] ?? TOKEN.text3) + "22", color: SOURCE_COLOR[selected.source] ?? TOKEN.text3 }}>
                  {SOURCE_LABEL[selected.source] ?? selected.source}
                </span>
                {selected.confidence != null && (
                  <span className="text-text-3">신뢰도 {(selected.confidence * 100).toFixed(0)}%</span>
                )}
              </div>
            )}

            {/* 재무/밸류에이션 (#1) */}
            {selected.financials && (
              <div className="bg-panel-2 rounded p-2.5 text-[10px] space-y-1">
                <p className="text-text-3 uppercase tracking-wider mb-1">밸류에이션</p>
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-text-3">시가총액</span>
                  <span className="text-text-1 font-data text-right">
                    {selected.financials.market_cap_usd_m != null ? `$${(selected.financials.market_cap_usd_m / 1000).toFixed(1)}B` : "—"}
                  </span>
                  <span className="text-text-3">포워드 PER</span>
                  <span className="text-text-1 font-data text-right">
                    {selected.financials.pe_ttm != null ? selected.financials.pe_ttm.toFixed(1) : "—"}
                  </span>
                  <span className="text-text-3">매출성장률(YoY)</span>
                  <span className={`font-data text-right px-1 font-bold ${(selected.financials.revenue_growth_yoy_pct ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                    {selected.financials.revenue_growth_yoy_pct != null ? `${selected.financials.revenue_growth_yoy_pct.toFixed(1)}%` : "—"}
                  </span>
                </div>
                {selected.financials.as_of && (
                  <p className="text-text-3 text-[9px] pt-0.5">기준: {new Date(selected.financials.as_of).toLocaleString("ko-KR")}</p>
                )}
              </div>
            )}

            {/* 병목 스코어 */}
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-3">병목 스코어</span>
                <span className="font-data" style={{ color: selected.bottleneck_score > 0.8 ? TOKEN.neg : selected.bottleneck_score > 0.6 ? TOKEN.accent : TOKEN.warn }}>
                  {(selected.bottleneck_score * 100).toFixed(0)} / 100
                </span>
              </div>
              <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${selected.bottleneck_score * 100}%`,
                  background: selected.bottleneck_score > 0.8 ? TOKEN.neg : selected.bottleneck_score > 0.6 ? TOKEN.accent : TOKEN.warn,
                }} />
              </div>
            </div>

            {/* 3축 리스크 */}
            <div className="space-y-1.5">
              {[
                { k: "supply_risk",       label: "공급 리스크",  color: categoricalColor(4) },
                { k: "demand_pressure",   label: "수요 압박",    color: categoricalColor(3) },
                { k: "policy_risk",       label: "정책 리스크",  color: categoricalColor(1) },
              ].map(({ k, label, color }) => {
                const v = (selected as unknown as Record<string, number>)[k] ?? 0;
                return (
                  <div key={k}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-text-3">{label}</span>
                      <span className="font-data text-text-2">{(v * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-panel-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 시계열 추세 (#2) — 병목 스코어 변화, 이벤트 시점은 update_log에서 확인 */}
            {history.length >= 2 && (
              <div className="bg-panel-2 rounded p-2.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-text-3 uppercase tracking-wider">병목 스코어 추세</span>
                  <span className="text-text-3">{history.length}개 스냅샷</span>
                </div>
                <svg width="100%" height="36" viewBox="0 0 220 36" preserveAspectRatio="none">
                  <path
                    d={sparklinePath(history.map(h => h.bottleneck_score ?? 0), 220, 32)}
                    fill="none" stroke={TOKEN.neg} strokeWidth={1.5}
                  />
                </svg>
                <div className="flex justify-between text-[9px] text-text-3 mt-0.5">
                  <span>{new Date(history[0].ts).toLocaleDateString("ko-KR")}</span>
                  <span>{new Date(history[history.length - 1].ts).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            )}

            {/* 분석 노트 */}
            {selected.note && (
              <div className="bg-panel-2 rounded p-2.5 text-[11px] text-text-2 leading-relaxed">
                {selected.note}
              </div>
            )}

            {/* 연결 엣지 */}
            {graph && (() => {
              const related = graph.edges.filter(e => e.source === selected.id || e.target === selected.id);
              if (!related.length) return null;
              return (
                <div>
                  <p className="text-text-3 text-[10px] uppercase tracking-wider mb-1.5">연결 관계 ({related.length})</p>
                  <div className="space-y-1">
                    {related.map((e, i) => {
                      const isCompetition = e.relation_category === "competition";
                      const isSource = e.source === selected.id;
                      const otherId = isSource ? e.target : e.source;
                      const other = graph.nodes.find(n => n.id === otherId);
                      return (
                        <div key={i} className={`text-[10px] px-2 py-1 rounded border ${isCompetition ? "border-border" : e.bottleneck ? "border-neg/30 bg-neg/5" : "border-border"}`}>
                          <div>
                            <span className="text-text-3">{isCompetition ? "↔" : isSource ? "→" : "←"}</span>
                            <span className="text-text-2 ml-1">{other?.label ?? otherId}</span>
                            <span className="text-text-3 ml-1">({RELATION_LABEL[e.relation] ?? e.relation})</span>
                            {e.bottleneck && <span className="ml-1 text-neg">⚠</span>}
                          </div>
                          {(e.dependency_pct != null || e.substitutable != null) && (
                            <div className="text-text-3 mt-0.5 flex items-center gap-2">
                              {e.dependency_pct != null && <span>의존도 {e.dependency_pct}%</span>}
                              {e.substitutable != null && (
                                <span className={`px-1 font-bold ${e.substitutable ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                                  {e.substitutable ? "대체 가능" : "대체 불가"}
                                </span>
                              )}
                            </div>
                          )}
                          {e.data_source && (
                            <div className="mt-0.5">
                              <span className="text-[9px]" style={{ color: SOURCE_COLOR[e.data_source] ?? TOKEN.text3 }}>
                                {SOURCE_LABEL[e.data_source] ?? e.data_source}
                                {e.confidence != null ? ` · 신뢰도 ${(e.confidence * 100).toFixed(0)}%` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {selected.last_updated && (
              <p className="text-text-3 text-[9px]">업데이트: {new Date(selected.last_updated).toLocaleString("ko-KR")}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 페이퍼 트레이딩 패널 ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-panel-2">
        {/* 헤더 바 */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
          <span className="text-text-3 text-[10px] uppercase tracking-wider">Paper Trading</span>
          {paper && (
            <>
              <span className="text-text-1 text-xs font-mono">
                ${paper.capital.toLocaleString()} 원금
              </span>
              <span className="text-text-2 text-xs font-mono">
                현금 <span className="text-text-1">${paper.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </span>
              <span className="text-xs font-mono">
                포지션 <span className="text-text-1">${paperPositionsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </span>
              <span className={`text-xs font-mono px-1 font-bold ${paperPnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                실현P&L {paperPnl >= 0 ? "+" : ""}${paperPnl.toFixed(2)}
              </span>
            </>
          )}
          <div className="ml-auto">
            <button onClick={handlePaperReset} disabled={paperResetting}
              className="text-[10px] px-2 py-0.5 rounded border border-border text-text-3 hover:text-neg hover:border-neg disabled:opacity-40">
              {paperResetting ? "초기화…" : "리셋"}
            </button>
          </div>
        </div>

        {/* 포지션 테이블 */}
        <div className="overflow-x-auto">
          {!paper || paper.positions.length === 0 ? (
            <p className="text-text-3 text-[11px] px-4 py-3">
              {paper ? "활성 포지션 없음 — AI 업데이트 시 병목 변화가 감지되면 자동 진입합니다." : "로딩 중…"}
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-text-3 text-[10px] border-b border-border">
                  {["종목", "방향", "진입가", "수량", "평가금액", "병목Δ", "진입시간", ""].map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paper.positions.map((pos: PaperPosition) => (
                  <tr key={pos.node_id} className="border-b border-border/50 hover:bg-panel">
                    <td className="px-3 py-1.5">
                      <span className="text-text-1 font-medium">{pos.symbol}</span>
                      <span className="text-text-3 ml-1">{pos.name}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${pos.side === "BUY" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-text-2">${pos.entry_price.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono text-text-2">{pos.qty}</td>
                    <td className="px-3 py-1.5 font-mono text-text-1">${pos.value.toLocaleString()}</td>
                    <td className="px-3 py-1.5 font-mono">
                      <span className={`px-1 font-bold ${pos.score_delta > 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                        {pos.score_delta > 0 ? "+" : ""}{pos.score_delta.toFixed(3)}
                      </span>
                      <span className="text-text-3 ml-1 text-[9px]">
                        {pos.entry_score.toFixed(2)}→{pos.current_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-text-3 text-[9px]">
                      {new Date(pos.entry_time).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => handleClosePosition(pos.node_id)}
                        className="text-[10px] px-2 py-0.5 rounded border border-neg/30 text-neg hover:bg-neg/10">
                        청산
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
