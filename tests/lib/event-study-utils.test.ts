import { describe, it, expect } from "vitest";
import { computeEventStudy } from "../../lib/event-study-utils";
import type { BarOut } from "../../lib/api";

// Helper: build synthetic bars. ts_event in nanoseconds.
// dates: array of YYYY-MM-DD strings, prices: close prices
function makeBars(dates: string[], closes: number[]): BarOut[] {
  return dates.map((d, i) => ({
    ts_event: new Date(d).getTime() * 1_000_000,  // ms → ns
    open: closes[i],
    high: closes[i],
    low: closes[i],
    close: closes[i],
    volume: 1000,
  }));
}

// 10 trading days: 2024-01-02 .. 2024-01-12
const DATES = [
  "2024-01-02","2024-01-03","2024-01-04","2024-01-05","2024-01-08",
  "2024-01-09","2024-01-10","2024-01-11","2024-01-12","2024-01-15",
];
const CLOSES = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118];
const BARS = makeBars(DATES, CLOSES);

describe("computeEventStudy", () => {
  it("produces correct number of day labels", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-05", label: "E1" }], 2);
    expect(result.dayLabels).toHaveLength(5);    // 2*2+1
    expect(result.dayLabels).toEqual(["-2", "-1", "0", "+1", "+2"]);
  });

  it("computes cumulative return relative to day-before-event", () => {
    // event on 2024-01-05 (close=106), base = 2024-01-04 close = 104
    // day 0 return = (106 - 104) / 104 ≈ 0.01923
    const result = computeEventStudy(BARS, [{ date: "2024-01-05", label: "E1" }], 1);
    const w = result.windows[0];
    expect(w.returns[1]).toBeCloseTo((106 - 104) / 104, 5);   // position 1 = day 0
    expect(w.returns[0]).toBeCloseTo((104 - 104) / 104, 5);   // day -1 = 0
    expect(w.returns[2]).toBeCloseTo((108 - 104) / 104, 5);   // day +1
  });

  it("returns all nulls when event date not in bars", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-06", label: "Weekend" }], 2);
    expect(result.windows[0].returns.every(v => v === null)).toBe(true);
  });

  it("computes avgReturns and hitRate correctly", () => {
    // Two events: both should show positive return at last position
    const events = [
      { date: "2024-01-04", label: "E1" },  // prices going up
      { date: "2024-01-08", label: "E2" },  // prices going up
    ];
    const result = computeEventStudy(BARS, events, 1);
    expect(result.stats.hitRate).toBe(1.0);     // both end positive
    expect(result.stats.eventCount).toBe(2);
    expect(result.stats.avgReturns[2]).toBeGreaterThan(0);  // +1 day avg > 0
  });

  it("empty events returns empty windows and null stats", () => {
    const result = computeEventStudy(BARS, [], 3);
    expect(result.windows).toHaveLength(0);
    expect(result.stats.eventCount).toBe(0);
    expect(result.stats.hitRate).toBeNull();
    expect(result.stats.avgReturns.every(v => v === null)).toBe(true);
  });

  it("handles windowDays=5 and returns correct label count", () => {
    const result = computeEventStudy(BARS, [{ date: "2024-01-09", label: "E1" }], 5);
    expect(result.dayLabels).toHaveLength(11);   // 2*5+1
    expect(result.dayLabels[5]).toBe("0");       // middle = day 0
    expect(result.dayLabels[0]).toBe("-5");
    expect(result.dayLabels[10]).toBe("+5");
  });
});
