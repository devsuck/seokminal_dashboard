import { describe, it, expect } from "vitest";
import { computeAssetWeightBars } from "@/components/hud/PortfolioTab";

describe("computeAssetWeightBars", () => {
  it("returns empty when fx rate is unavailable", () => {
    expect(computeAssetWeightBars(1_000_000, 500, 200, null)).toEqual([]);
  });

  it("returns empty when total USD-equivalent is zero", () => {
    expect(computeAssetWeightBars(null, 0, null, 1300)).toEqual([]);
  });

  it("splits KRW/USD/USDC balances into USD-equivalent weight percentages", () => {
    const bars = computeAssetWeightBars(1_300_000, 1000, 1000, 1300);
    expect(bars).toHaveLength(3);
    expect(bars.map(b => b.label)).toEqual(["국내주식", "해외주식", "코인"]);
    for (const b of bars) expect(b.value).toBeCloseTo(33.33, 1);
  });

  it("omits a currency with zero balance", () => {
    const bars = computeAssetWeightBars(null, 1000, null, 1300);
    expect(bars).toHaveLength(1);
    expect(bars[0].label).toBe("해외주식");
    expect(bars[0].value).toBeCloseTo(100, 5);
  });
});
