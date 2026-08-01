import { describe, it, expect } from "vitest";
import { filterGroupsForOperator, type RailGroup } from "../../components/console/CommandRail";

const GROUPS: RailGroup[] = [
  { label: "트레이딩 데스크", items: [{ href: "/hud", label: "HUD" }] },
  { label: "봇 · 에이전트", items: [{ href: "/agents", label: "에이전트" }] },
  { label: "Research · 모니터링", items: [{ href: "/research-os/cockpit", label: "콕핏" }] },
  { label: "검증 · 백테스트", items: [{ href: "/backtest", label: "백테스트" }] },
];

describe("filterGroupsForOperator", () => {
  it("화이트리스트 3개 그룹만 남김", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.map((g) => g.label)).toEqual(["트레이딩 데스크", "봇 · 에이전트", "Research · 모니터링"]);
  });

  it("화이트리스트 밖 그룹은 제외", () => {
    const result = filterGroupsForOperator(GROUPS);
    expect(result.find((g) => g.label === "검증 · 백테스트")).toBeUndefined();
  });
});
