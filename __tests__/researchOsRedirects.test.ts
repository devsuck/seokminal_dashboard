import { describe, it, expect } from "vitest";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

describe("OLD_TO_NEW research-os redirect map", () => {
  it("has exactly 15 entries", () => {
    expect(Object.keys(OLD_TO_NEW)).toHaveLength(15);
  });

  it("maps every old route to a shell route with a matching ?tab=", () => {
    const expected: Record<string, string> = {
      "/research-os/workflow": "/research-os/pipeline?tab=workflow",
      "/research-os/discovery": "/research-os/pipeline?tab=discovery",
      "/research-os/strategy-generation": "/research-os/pipeline?tab=strategy-generation",
      "/research-os/strategy-lab": "/research-os/pipeline?tab=strategy-lab",
      "/research-os/agents": "/research-os/pipeline?tab=agents",
      "/research-os/brain": "/research-os/pipeline?tab=brain",
      "/research-os/cockpit": "/research-os/pipeline?tab=cockpit",
      "/research-os/console": "/research-os/pipeline?tab=console",
      "/research-os/validation": "/research-os/validation?tab=validation",
      "/research-os/production": "/research-os/validation?tab=production",
      "/research-os/intelligence-plus": "/research-os/validation?tab=intelligence-plus",
      "/research-os/committee": "/research-os/governance?tab=committee",
      "/research-os/explain": "/research-os/governance?tab=explain",
      "/research-os/graph": "/research-os/governance?tab=graph",
      "/research-os/timeline": "/research-os/governance?tab=timeline",
    };
    expect(OLD_TO_NEW).toEqual(expected);
  });

  it("every target route starts with a known shell path", () => {
    const shells = ["/research-os/pipeline?tab=", "/research-os/validation?tab=", "/research-os/governance?tab="];
    for (const target of Object.values(OLD_TO_NEW)) {
      expect(shells.some((s) => target.startsWith(s))).toBe(true);
    }
  });
});
