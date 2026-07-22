import { type EdgeReport, type EdgeVariant } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Heatmap, type HeatCell } from "@/components/charts/Heatmap";
import { NullDistribution } from "@/components/charts/NullDistribution";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { seqColor } from "@/lib/chart-colors";

export const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  candidate: { label: "후보 (BH-FDR 생존)", cls: "border-pos/50 text-pos bg-pos/15" },
  no_edge: { label: "확인된 엣지 없음", cls: "border-text-3/40 text-text-3 bg-black/20" },
  no_data: { label: "데이터 대기", cls: "border-info/40 text-info bg-info/10" },
};

function EdgeHeatmap({ rep }: { rep: EdgeReport }) {
  const groups = rep.groups ?? [];
  const rows = groups.map(g => g.group);
  const colSet = new Set<string>();
  groups.forEach(g => (g.horizons ?? []).forEach(h => colSet.add(h.horizon)));
  const cols = [...colSet].sort((a, b) => parseInt(a) - parseInt(b));
  if (cols.length === 0) return null; // 전부 BLOCKED — 히트맵 생략

  const byName = new Map(groups.map(g => [g.group, g]));
  const cellOf = (row: string, col: string): HeatCell => {
    const g = byName.get(row);
    if (!g || g.blocked) return { value: null, blocked: true, tooltip: `${row}: BLOCKED${g?.reason ? " · " + g.reason : ""}` };
    const h = (g.horizons ?? []).find(hh => hh.horizon === col);
    if (!h) return { value: null, blocked: true, tooltip: `${row}:${col}: 없음` };
    return { value: h.p_value, tooltip: `${row}:${col} · p=${h.p_value.toFixed(4)} · n=${h.n_events} · net=${h.total_pnl.toFixed(2)}` };
  };

  return (
    <ChartFrame
      title="p-value 히트맵 (group × horizon)"
      caption="셀 밝을수록 유의(낮은 p). 정확한 값은 아래 테이블 · 유의 ≠ BH-FDR 생존."
    >
      <Heatmap rows={rows} cols={cols} cellOf={cellOf} colorOf={(p) => seqColor(1 - p)} />
    </ChartFrame>
  );
}

function EdgeVariantTable({ variants }: { variants: EdgeVariant[] }) {
  const nCovered = variants.filter(v => !v.blocked).reduce((s, v) => s + (v.n_events ?? 0), 0);
  return (
    <>
      <div className="flex items-center gap-3 text-[11px] flex-wrap">
        <span className="text-text-3">변형 {variants.length}개 (랭킹지표×임계×N)</span>
        <span className="text-text-3">라벨 {nCovered}건</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-data">
          <thead>
            <tr className="text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
              <th className="px-2 py-1 text-left font-medium">변형</th>
              <th className="px-2 py-1 text-right font-medium">n</th>
              <th className="px-2 py-1 text-right font-medium">net</th>
              <th className="px-2 py-1 text-right font-medium">p-value</th>
              <th className="px-2 py-1 text-left font-medium">vs 랜덤(percentile)</th>
            </tr>
          </thead>
          <tbody>
            {variants.map(v => v.blocked ? (
              <tr key={v.variant} className="border-b border-border/40">
                <td className="px-2 py-1 text-text-3">{v.variant}</td>
                <td className="px-2 py-1 text-text-3 text-[10px] text-right" colSpan={4}>BLOCKED · {v.reason}</td>
              </tr>
            ) : (
              <tr key={v.variant} className="border-b border-border/40 hover:bg-panel-2">
                <td className="px-2 py-1 text-text-1">{v.variant}</td>
                <td className="px-2 py-1 text-right text-text-2 tabular-nums">{v.n_events}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${(v.total_pnl ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>{(v.total_pnl ?? 0).toFixed(2)}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${(v.p_value ?? 1) < 0.05 ? "text-accent font-bold" : "text-text-2"}`}>{(v.p_value ?? 0).toFixed(4)}</td>
                <td className="px-2 py-1"><NullDistribution percentile={v.percentile ?? 0.5} pValue={v.p_value ?? 1} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function EdgeReportCard({ hyp, rep }: { hyp: string; rep: EdgeReport }) {
  const vb = VERDICT_BADGE[rep.verdict ?? ""] ?? { label: rep.verdict ?? "—", cls: "border-border text-text-3" };
  const nAnchors = rep.n_anchors ?? 0;
  const smallSample = nAnchors > 0 && nAnchors < 30;
  const byVariant = rep.variants != null; // group×horizon(sharp/whale) 대신 변형 그리드(MLB 컨센서스 등)
  return (
    <Panel>
      <PanelHeader right={<span className={`px-2 py-0.5 rounded border text-[10px] ${vb.cls}`}>{vb.label}</span>}>
        {hyp}
      </PanelHeader>
      {rep.error ? <div className="p-3 text-neg text-xs">검증 실패: {rep.error}</div>
        : rep.verdict === "no_data" ? <div className="p-3 text-text-3 text-xs">수집 데이터 대기 중 — 틱 쌓이면 자동 계산됨</div>
        : (
          <div className="p-3 space-y-3">
            {byVariant ? <EdgeVariantTable variants={rep.variants!} /> : (
              <>
                <div className="flex items-center gap-3 text-[11px] flex-wrap">
                  <span className="text-text-3">커버리지 {rep.dates?.length ?? 0}일</span>
                  <span className={smallSample ? "text-warn font-bold" : "text-text-3"}>
                    표본 {nAnchors}{smallSample ? " · 부족(신뢰도 낮음)" : ""}
                  </span>
                  <span className="text-text-3">cost {rep.cost_bps}bps</span>
                </div>

                {/* group×horizon p-value 히트맵 (셀 밝을수록 유의) */}
                <EdgeHeatmap rep={rep} />

                {/* p-value 테이블 (정확한 수치 · 접근성 table view) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-data">
                    <thead>
                      <tr className="text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
                        <th className="px-2 py-1 text-left font-medium">그룹:호라이즌</th>
                        <th className="px-2 py-1 text-right font-medium">n</th>
                        <th className="px-2 py-1 text-right font-medium">net</th>
                        <th className="px-2 py-1 text-right font-medium">p-value</th>
                        <th className="px-2 py-1 text-left font-medium">vs 랜덤(percentile)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rep.groups ?? []).map(g => g.blocked ? (
                        <tr key={g.group} className="border-b border-border/40">
                          <td className="px-2 py-1 text-text-3">{g.group}</td>
                          <td className="px-2 py-1 text-text-3 text-[10px] text-right" colSpan={4}>BLOCKED · {g.reason}</td>
                        </tr>
                      ) : (g.horizons ?? []).map(h => (
                        <tr key={`${g.group}:${h.horizon}`} className="border-b border-border/40 hover:bg-panel-2">
                          <td className="px-2 py-1 text-text-1">{g.group}:{h.horizon}</td>
                          <td className="px-2 py-1 text-right text-text-2 tabular-nums">{h.n_events}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${h.total_pnl >= 0 ? "text-pos" : "text-neg"}`}>{h.total_pnl.toFixed(2)}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${h.p_value < 0.05 ? "text-accent font-bold" : "text-text-2"}`}>{h.p_value.toFixed(4)}</td>
                          <td className="px-2 py-1"><NullDistribution percentile={h.percentile} pValue={h.p_value} /></td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* BH-FDR 풀 */}
            <div className="space-y-1 border-t border-border pt-2">
              {(rep.pools ?? []).map(p => (
                <div key={p.name} className="flex items-center gap-2 text-[11px]">
                  <span className="text-text-3 w-28 shrink-0">BH-FDR [{p.name}]</span>
                  <span className={`font-data font-bold px-1 ${p.n_survivors > 0 ? "bg-pos/20 text-pos" : "text-text-3"}`}>
                    {p.n_survivors}/{p.n_tested} 생존
                  </span>
                  <span className="text-text-3 truncate">
                    {p.n_survivors > 0 ? p.survivors.join(", ") : "확인된 엣지 없음 (정직한 결과)"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </Panel>
  );
}
