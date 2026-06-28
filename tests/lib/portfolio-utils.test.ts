import { describe, it, expect } from "vitest";
import { computeAttribution } from "../../lib/portfolio-utils";
import type { AttributionInput } from "../../lib/portfolio-utils";
import type { TimeSeriesPoint } from "../../lib/api";

function makePoint(cumulative_return: number): TimeSeriesPoint {
  return {
    ts_ns: 1_000_000_000_000,
    daily_return: 0.01,
    cumulative_return,
    drawdown: 0,
    rolling_sharpe: null,
    benchmark_cumulative: null,
  };
}

function makePoints(cumRet: number): TimeSeriesPoint[] {
  return [makePoint(0), makePoint(cumRet * 0.5), makePoint(cumRet)];
}

describe("computeAttribution", () => {
  it("computes contribution = weight × totalReturn", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "A", weight: 0.6 }];
    const seriesMap = { A: makePoints(0.2) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].totalReturn).toBeCloseTo(0.2, 5);
    expect(result.instruments[0].contribution).toBeCloseTo(0.12, 5);
  });

  it("sums contributions for portfolioReturn", () => {
    const inputs: AttributionInput[] = [
      { instrumentId: "A", weight: 0.5 },
      { instrumentId: "B", weight: 0.5 },
    ];
    const seriesMap = { A: makePoints(0.2), B: makePoints(0.1) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.portfolioReturn).toBeCloseTo(0.15, 5);
  });

  it("handles missing series (contribution = 0)", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "MISSING", weight: 1.0 }];
    const seriesMap = {};
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].totalReturn).toBe(0);
    expect(result.instruments[0].contribution).toBe(0);
    expect(result.portfolioReturn).toBe(0);
  });

  it("sorts by absolute contribution descending", () => {
    const inputs: AttributionInput[] = [
      { instrumentId: "A", weight: 0.1 },
      { instrumentId: "B", weight: 0.5 },
      { instrumentId: "C", weight: 0.4 },
    ];
    const seriesMap = {
      A: makePoints(0.5),    // contribution = 0.05
      B: makePoints(-0.3),   // contribution = -0.15 → abs 0.15
      C: makePoints(0.4),    // contribution = 0.16
    };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].instrumentId).toBe("C");  // |0.16|
    expect(result.instruments[1].instrumentId).toBe("B");  // |−0.15|
    expect(result.instruments[2].instrumentId).toBe("A");  // |0.05|
  });

  it("handles negative returns (short portfolio)", () => {
    const inputs: AttributionInput[] = [{ instrumentId: "A", weight: 1.0 }];
    const seriesMap = { A: makePoints(-0.3) };
    const result = computeAttribution(inputs, seriesMap);
    expect(result.instruments[0].contribution).toBeCloseTo(-0.3, 5);
    expect(result.portfolioReturn).toBeCloseTo(-0.3, 5);
  });

  it("handles empty inputs", () => {
    const result = computeAttribution([], {});
    expect(result.portfolioReturn).toBe(0);
    expect(result.instruments).toHaveLength(0);
  });
});
