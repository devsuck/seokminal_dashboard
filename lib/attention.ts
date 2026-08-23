export type AttentionTone = "neg" | "warn" | "info";

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: AttentionTone;
}

export interface AttentionInput {
  pipeline: { proposals: number } | null;
  risk: { by_status: Record<string, number> } | null;
  investmentOs: {
    gates: { passed?: boolean };
    execution_ladder: { human_approval_mandatory: boolean };
  } | null;
  autoResearch: { n_candidates: number } | null;
}

export function deriveAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.pipeline && input.pipeline.proposals > 0) {
    items.push({
      id: "pipeline-proposals", label: "제안 승인 대기",
      detail: `${input.pipeline.proposals}건`, href: "/investment-os", tone: "warn",
    });
  }

  const blocked = input.risk?.by_status?.BLOCK ?? 0;
  if (blocked > 0) {
    items.push({
      id: "risk-block", label: "리스크 차단 이벤트",
      detail: `${blocked}건`, href: "/hud", tone: "neg",
    });
  }

  if (input.investmentOs?.gates.passed && input.investmentOs.execution_ladder.human_approval_mandatory) {
    items.push({
      id: "ladder-gate", label: "준비도 사다리 다음 단계 승인 가능",
      detail: "자문용 — 실제 실행/전략 변경 없음", href: "/investment-os?tab=ops", tone: "info",
    });
  }

  if (input.autoResearch && input.autoResearch.n_candidates > 0) {
    items.push({
      id: "research-candidates", label: "리서치 후보 검토 대기",
      detail: `${input.autoResearch.n_candidates}건`, href: "/auto-research", tone: "info",
    });
  }

  return items;
}
