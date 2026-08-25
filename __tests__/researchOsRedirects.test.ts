import { describe, it, expect } from "vitest";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

describe("OLD_TO_NEW redirect map", () => {
  it("has exactly 19 entries", () => {
    expect(Object.keys(OLD_TO_NEW)).toHaveLength(19);
  });

  it("maps every old route to a shell route with a matching ?tab=", () => {
    const expected: Record<string, string> = {
      "/research-os/validation": "/research-os/validation?tab=validation",
      "/research-os/production": "/research-os/validation?tab=production",
      "/research-os/intelligence-plus": "/research-os/validation?tab=intelligence-plus",
      "/research-os/committee": "/research-os/governance?tab=committee",
      "/research-os/explain": "/research-os/governance?tab=explain",
      "/research-os/graph": "/research-os/governance?tab=graph",
      "/research-os/timeline": "/research-os/governance?tab=timeline",
      "/overview": "/hud?tab=portfolio",
      "/auto-research": "/hud",
      "/council/agents": "/investment-os?tab=risk",
      "/council/decisions": "/investment-os?tab=risk",
      "/council/logs": "/investment-os?tab=risk",
      "/exec/monitor": "/investment-os?tab=ops",
      "/exec/orders": "/investment-os?tab=ops",
      "/portfolio-os/allocation": "/investment-os?tab=overview",
      "/portfolio-os/positions": "/investment-os?tab=overview",
      "/portfolio-os/risk": "/investment-os?tab=risk",
      "/calendar": "/hud",
      "/insider": "/hud",
    };
    expect(OLD_TO_NEW).toEqual(expected);
  });

  it("every target route starts with a known shell path", () => {
    const shells = [
      "/research-os/validation?tab=", "/research-os/governance?tab=",
      "/hud", "/investment-os?tab=",
    ];
    for (const target of Object.values(OLD_TO_NEW)) {
      expect(shells.some((s) => target.startsWith(s))).toBe(true);
    }
  });
});
