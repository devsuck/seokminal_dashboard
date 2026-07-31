"use client";
import { getAllocation, getFusion, getOverlay } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";

function dirLabel(d: number): string { return d > 0 ? "매수" : d < 0 ? "매도" : "중립"; }
function dirTone(d: number): "pos" | "neg" | "mute" { return d > 0 ? "pos" : d < 0 ? "neg" : "mute"; }

export default function Allocation() {
  const { data, err, loading } = useConsole(getAllocation);
  const fusion = useConsole(getFusion);
  const overlay = useConsole(getOverlay);
  const derived = data?.derived_proposal ?? [];
  const hasLedger = (data?.allocations.length ?? 0) > 0;
  const signals = fusion.data?.fusion_signals ?? [];
  const overlayRows = overlay.data?.overlay ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="포트폴리오 OS" title="배분"
        right={<Badge tone={hasLedger?"pos":"hud"}>{hasLedger?"오케스트레이터":"제안값(파생)"}</Badge>} />
      <div className="p-5 space-y-5 max-w-[1150px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="활성 전략" value={derived.length} tone="hud" accent="hud" />
            <StatTile label="장부 제안" value={data?.allocations.length ?? 0} accent="info" />
            <StatTile label="의사결정" value={data?.decisions.length ?? 0} accent="warn" />
          </div>
          <Panel className="overflow-hidden">
            <PanelHead kicker="제안" title="동일가중 배분 (제안 전용 · 미집행)"
              right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.derived_note}</span>} />
            <div className="p-4 space-y-2">
              {derived.length===0 && <div className="text-[11px] text-[var(--c-text-3)] p-3">활성 전략 없음</div>}
              {derived.map((d) => (
                <div key={d.strategy_id} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-text-1)] w-52 shrink-0 truncate">{d.name}</span>
                  <span className="text-[10px] text-[var(--c-hud)] w-24 shrink-0">{d.factor}</span>
                  <StatusPill status={d.status} />
                  <div className="flex-1 h-2 bg-[var(--c-panel-3)] overflow-hidden">
                    <div className="h-full" style={{width:`${d.target_weight*100}%`, background:"var(--c-hud)", boxShadow:"0 0 8px var(--c-hud)"}} />
                  </div>
                  <span className="c-num text-[12px] font-semibold text-[var(--c-text-1)] w-14 text-right">{(d.target_weight*100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </StateBlock>
        <StateBlock loading={fusion.loading} err={fusion.err}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="P1 · 자문" title="신호 퓨전 (계기별 합성신호 · 참고용)"
              right={<Badge tone={signals.length?"hud":"mute"}>{signals.length}</Badge>} />
            <div className="p-4 space-y-2">
              {signals.length===0 && (
                <div className="text-[11px] text-[var(--c-text-3)] p-3">{fusion.data?.note || "합성신호 없음"}</div>
              )}
              {signals.map((s) => (
                <div key={s.instrument} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-text-1)] w-32 shrink-0 truncate c-num">{s.instrument}</span>
                  <Badge tone={dirTone(s.direction)}>{dirLabel(s.direction)}</Badge>
                  <div className="flex-1">
                    <Meter value={s.confidence} tone="hud" />
                  </div>
                  <span className="c-num text-[11px] text-[var(--c-text-3)] w-14 text-right">{(s.confidence*100).toFixed(0)}%</span>
                  <span className="text-[10px] text-[var(--c-text-3)] w-20 shrink-0 text-right">{s.n_strategies}개 전략</span>
                </div>
              ))}
            </div>
          </Panel>
        </StateBlock>
        <StateBlock loading={overlay.loading} err={overlay.err}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="P2.5 · 참고용" title="신호 오버레이 (전략비중×종목신호 합성)"
              right={<Badge tone={overlayRows.length?"hud":"mute"}>{overlayRows.length}</Badge>} />
            <div className="p-4 space-y-2">
              {overlayRows.length===0 && (
                <div className="text-[11px] text-[var(--c-text-3)] p-3">{overlay.data?.note || "오버레이 없음"}</div>
              )}
              {overlayRows.map((r) => (
                <div key={`${r.strategy_id}-${r.instrument}`} className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--c-hud)] w-24 shrink-0 truncate">{r.strategy_id}</span>
                  <span className="text-[12px] text-[var(--c-text-1)] w-24 shrink-0 truncate c-num">{r.instrument}</span>
                  <Badge tone={dirTone(r.direction)}>{dirLabel(r.direction)}</Badge>
                  <span className="c-num text-[11px] text-[var(--c-text-3)] w-16 text-right">{(r.instrument_target_weight*100).toFixed(1)}%</span>
                  {r.conflict && <Badge tone="neg">FUSION 상충</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
