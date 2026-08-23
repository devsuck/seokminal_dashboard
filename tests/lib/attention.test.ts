import { describe, it, expect } from "vitest";
import { deriveAttentionItems } from "../../lib/attention";

describe("deriveAttentionItems", () => {
  it("모든 입력 null이면 빈 배열", () => {
    const items = deriveAttentionItems({ pipeline: null, risk: null, investmentOs: null, autoResearch: null });
    expect(items).toEqual([]);
  });

  it("proposals > 0이면 파이프라인 승인 대기 카드", () => {
    const items = deriveAttentionItems({
      pipeline: { proposals: 3 }, risk: null, investmentOs: null, autoResearch: null,
    });
    expect(items).toContainEqual({
      id: "pipeline-proposals", label: "제안 승인 대기", detail: "3건", href: "/investment-os", tone: "warn",
    });
  });

  it("proposals == 0이면 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: { proposals: 0 }, risk: null, investmentOs: null, autoResearch: null,
    });
    expect(items.find((i) => i.id === "pipeline-proposals")).toBeUndefined();
  });

  it("risk.by_status.BLOCK > 0이면 리스크 차단 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: { by_status: { ALLOW: 10, BLOCK: 2 } }, investmentOs: null, autoResearch: null,
    });
    expect(items).toContainEqual({
      id: "risk-block", label: "리스크 차단 이벤트", detail: "2건", href: "/hud", tone: "neg",
    });
  });

  it("BLOCK 없으면 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: { by_status: { ALLOW: 10 } }, investmentOs: null, autoResearch: null,
    });
    expect(items.find((i) => i.id === "risk-block")).toBeUndefined();
  });

  it("gates.passed && human_approval_mandatory면 승격 대기 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, autoResearch: null,
      investmentOs: { gates: { passed: true }, execution_ladder: { human_approval_mandatory: true } },
    });
    expect(items).toContainEqual({
      id: "ladder-gate", label: "준비도 사다리 다음 단계 승인 가능",
      detail: "자문용 — 실제 실행/전략 변경 없음", href: "/investment-os?tab=ops", tone: "info",
    });
  });

  it("gates.passed가 false면 승격 카드 없음", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, autoResearch: null,
      investmentOs: { gates: { passed: false }, execution_ladder: { human_approval_mandatory: true } },
    });
    expect(items.find((i) => i.id === "ladder-gate")).toBeUndefined();
  });

  it("n_candidates > 0이면 리서치 후보 카드", () => {
    const items = deriveAttentionItems({
      pipeline: null, risk: null, investmentOs: null, autoResearch: { n_candidates: 5 },
    });
    expect(items).toContainEqual({
      id: "research-candidates", label: "리서치 후보 검토 대기", detail: "5건", href: "/auto-research", tone: "info",
    });
  });
});
