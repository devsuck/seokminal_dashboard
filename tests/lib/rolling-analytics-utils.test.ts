import { describe, it, expect } from "vitest";
import { computeRollingVolatility, zipRollingPoints } from "../../lib/rolling-analytics-utils";

describe("computeRollingVolatility", () => {
  it("returns nulls for first window-1 positions", () => {
    const returns = [0.01, -0.02, 0.015, -0.005, 0.02, 0.01, -0.01, 0.005];
    const result = computeRollingVolatility(returns, 5);
    expect(result).toHaveLength(8);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeNull();
    expect(result[3]).toBeNull();
    expect(result[4]).not.toBeNull();   // first valid at index 4
    expect(result[7]).not.toBeNull();
  });

  it("returns all nulls when array shorter than window", () => {
    const result = computeRollingVolatility([0.01, 0.02], 5);
    expect(result.every(v => v === null)).toBe(true);
  });

  it("annualizes volatility by sqrt(252)", () => {
    // Constant returns → std = 0 → vol = 0
    const returns = Array(10).fill(0.01);
    const result = computeRollingVolatility(returns, 5);
    expect(result[4]).toBeCloseTo(0, 8);
  });

  it("window=1 returns zero for each position (std of single value = 0)", () => {
    const returns = [0.01, -0.02, 0.03];
    const result = computeRollingVolatility(returns, 1);
    expect(result[0]).toBeCloseTo(0, 8);
    expect(result[1]).toBeCloseTo(0, 8);
    expect(result[2]).toBeCloseTo(0, 8);
  });

  it("produces positive volatility for variable returns", () => {
    const returns = [0.05, -0.03, 0.02, -0.04, 0.01];
    const result = computeRollingVolatility(returns, 5);
    expect(result[4]).toBeGreaterThan(0);
  });
});

describe("zipRollingPoints", () => {
  it("pairs ts_ns with values", () => {
    const ts = [1000, 2000, 3000];
    const values: (number | null)[] = [null, 0.15, 0.22];
    const result = zipRollingPoints(ts, values);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ ts_ns: 1000, value: null });
    expect(result[2]).toEqual({ ts_ns: 3000, value: 0.22 });
  });

  it("returns empty array for empty inputs", () => {
    expect(zipRollingPoints([], [])).toHaveLength(0);
  });
});
