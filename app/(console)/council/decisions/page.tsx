"use client";
import { getConsoleCouncil } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Badge, Dot } from "@/components/console/primitives";

export default function CouncilDecisions() {
  const { data, err, loading } = useConsole((s) => getConsoleCouncil(40, s));
  const rows = data?.decisions ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="AI 협의회" title="의사결정 피드"
        right={<Badge tone="hud">{data?.source ?? "—"}</Badge>} />
      <div className="p-5 max-w-[1000px]">
        <StateBlock loading={loading} err={err} empty={!rows.length} emptyNote="포트폴리오 의사결정 엔진이 결정을 생성하면 여기에 표시됩니다.">
          <Panel>
            <PanelHead kicker="스트림" title="최근 의사결정" right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.count ?? 0}</span>} />
            <ul className="p-2">
              {[...rows].reverse().map((d, i) => (
                <li key={i} className="flex items-start gap-3 px-2 py-2.5 border-b border-[var(--c-border)] last:border-0">
                  <Dot tone="hud" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-[var(--c-text-1)]">{String(d.action ?? d.decision ?? d.event ?? d.message ?? "결정")}</div>
                    <div className="text-[10px] c-num text-[var(--c-text-3)] mt-0.5 truncate">
                      {String(d.strategy ?? d.proposal_id ?? d.layer ?? "")} · {String(d.timestamp ?? d.ts ?? "")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
