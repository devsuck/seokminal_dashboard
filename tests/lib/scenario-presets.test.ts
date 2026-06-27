import { describe, it, expect } from "vitest";
import { SCENARIOS, findScenario } from "../../lib/scenario-presets";

describe("scenario-presets", () => {
  it("has exactly 8 scenarios", () => {
    expect(SCENARIOS).toHaveLength(8);
  });

  it("all scenarios have valid date range (start < end)", () => {
    for (const s of SCENARIOS) {
      expect(new Date(s.start) < new Date(s.end)).toBe(true);
    }
  });

  it("all scenario IDs are unique", () => {
    const ids = SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("all scenarios have non-empty label and description", () => {
    for (const s of SCENARIOS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("findScenario('gfc') returns 2008 Financial Crisis", () => {
    const s = findScenario("gfc");
    expect(s?.label).toBe("2008 Financial Crisis");
    expect(s?.start).toBe("2007-10-01");
    expect(s?.end).toBe("2009-03-31");
  });

  it("findScenario('covid') returns COVID Crash", () => {
    const s = findScenario("covid");
    expect(s?.start).toBe("2020-02-01");
    expect(s?.end).toBe("2020-04-30");
  });

  it("findScenario returns undefined for unknown ID", () => {
    expect(findScenario("unknown_xyz")).toBeUndefined();
  });
});
