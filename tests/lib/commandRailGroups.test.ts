import { describe, it, expect } from "vitest";
import { filterGroupsForOperator, type RailGroup } from "../../components/console/CommandRail";

const GROUPS: RailGroup[] = [
  { label: "트레이딩 데스크", items: [{ href: "/hud", label: "HUD" }] },
  { label: "봇 · 에이전트", items: [{ href: "/agents", label: "에이전트" }] },
  { label: "Research OS", items: [{ href: "/research-os/pipeline", label: "파이프라인" }] },
  { label: "검증 · 백테스트", items: [{ href: "/backtest", label: "백테스트" }] },
];

describe("filterGroupsForOperator", () => {
  it("화이트리스트 3개 그룹만 남김", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.map((g) => g.label)).toEqual(["트레이딩 데스크", "봇 · 에이전트", "Research OS"]);
  });

  it("화이트리스트 밖 그룹은 제외", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.find((g) => g.label === "검증 · 백테스트")).toBeUndefined();
  });
});
