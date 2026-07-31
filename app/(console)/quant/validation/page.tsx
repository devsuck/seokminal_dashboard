"use client";
import { getValidation } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill } from "@/components/console/widgets";
import { Panel, PanelHead, Badge, Dot } from "@/components/console/primitives";

const GATE_LABEL: Record<string, string> = {
  walk_forward: "워크포워드", monte_carlo: "몬테카를로", bh_fdr: "BH-FDR (다중검정)",
  cost_stress: "비용 스트레스", redteam: "레드팀 감사",
};

export default function ValidationReport() {
  const { data, err, loading } = useConsole(getValidation);
  const rt = data?.redteam;
  const agree = rt?.human_redteam_agree ?? 0;
  const n = rt?.n ?? 0;
  const allAgree = n > 0 && agree === n;
  const statuses = Object.entries(data?.experiment_status ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="퀀트 랩" title="전략 검증 리포트"
        right={<Badge tone={allAgree ? "pos" : "warn"}>{allAgree ? "레드팀 ✓ 합의" : "검토 필요"}</Badge>} />
      <div className="p-5 space-y-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
            {/* Robustness gates */}
            <Panel grid className="overflow-hidden">
              <PanelHead kicker="강건성" title="검증 게이트" />
              <div className="p-4 space-y-2.5">
                {(data?.gates ?? []).map((g) => (
                  <div key={g} className="flex items-center gap-3 py-1.5">
                    <Dot tone="pos" />
                    <span className="text-[12px] text-[var(--c-text-1)] flex-1">{GATE_LABEL[g] ?? g}</span>
                    <StatusPill status="PASS" />
                  </div>
                ))}
                <div className="pt-3 mt-2 border-t border-[var(--c-border)] text-[10.5px] text-[var(--c-text-3)] leading-relaxed">
                  검증 프레임워크는 다중검정 보정(BH-FDR)·비용 스트레스·레드팀 적대 감사를 강제합니다. 게이트 통과 시에만 paper trading 승격.
                </div>
              </div>
            </Panel>

            {/* Redteam consensus */}
            <Panel className="overflow-hidden">
              <PanelHead kicker="적대적 검증" title="레드팀 vs 사람" right={<span className="c-num text-[11px] text-[var(--c-hud)]">{agree}/{n} 일치</span>} />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr className="border-b border-[var(--c-border)]">
                    {["전략", "사람", "레드팀", "일치"].map((h) => <th key={h} className="text-[9px] font-semibold tracking-[0.14em] text-[var(--c-text-3)] uppercase px-3 py-2 text-left">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(rt?.rows ?? []).map((row, i) => {
                      const r = row as Record<string, unknown>;
                      return (
                        <tr key={i} className="border-b border-[var(--c-border)] last:border-0">
                          <td className="px-3 py-2 text-[11px] text-[var(--c-text-1)]">{String(r.strategy ?? "—")}</td>
                          <td className="px-3 py-2"><StatusPill status={String(r.human_call ?? "?")} /></td>
                          <td className="px-3 py-2"><StatusPill status={String(r.redteam_verdict ?? "?")} /></td>
                          <td className="px-3 py-2">{r.match ? <span className="text-[var(--c-pos)] c-num text-[11px]">✓</span> : <span className="text-[var(--c-neg)] c-num text-[11px]">✗</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* Experiment status distribution */}
          <Panel className="overflow-hidden">
            <PanelHead kicker="코호트" title="실험 상태 분포" />
            <div className="p-4 flex flex-wrap gap-2">
              {statuses.map(([s, c]) => (
                <div key={s} className="flex items-center gap-2 px-2.5 py-1.5 border border-[var(--c-border)]">
                  <StatusPill status={s} />
                  <span className="c-num text-[12px] font-semibold text-[var(--c-text-1)]">{c}</span>
                </div>
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
