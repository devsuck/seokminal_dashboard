import { describe, it, expect } from "vitest";
import { computeFactor } from "../../lib/factor-utils";
import type { InstrumentBars } from "../../lib/factor-utils";
import type { BarOut } from "../../lib/api";

function makeBar(dateStr: string, close: number): BarOut {
  return {
    ts_event: new Date(dateStr).getTime() * 1_000_000,
    open: close, high: close, low: close, close, volume: 1000,
  };
}

function makeInstrument(id: string, closes: number[], startDate = "2024-01-02"): InstrumentBars {
  const bars: BarOut[] = closes.map((c, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return makeBar(d.toISOString().slice(0, 10), c);
  });
  return { instrumentId: id, bars };
}

describe("computeFactor — momentum", () => {
  it("computes correct momentum return", () => {
    // horizon=1 shifts "now" to bars[5]=110; lookback=5 uses bars[0]=100 → (110-100)/100 = 0.1
    // bars[6]=112 is the future bar (consumed by IC but not checked here)
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110, 112]),
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.values[0].instrumentId).toBe("A.X");
    expect(result.values[0].value).toBeCloseTo(0.1, 5);
  });

  it("sorts by value descending", () => {
    // trailing bar added so horizon=1 can shift "now" to bars[5]
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110, 112]),  // +10%
      makeInstrument("B.X", [100, 98, 96, 94, 92, 90, 88]),        // -10%
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.values[0].instrumentId).toBe("A.X");
    expect(result.values[1].instrumentId).toBe("B.X");
  });

  it("returns null value when not enough history", () => {
    const instruments: InstrumentBars[] = [makeInstrument("A.X", [100, 102])];
    const result = computeFactor(instruments, "momentum", 10, 1);
    expect(result.values[0].value).toBeNull();
  });

  it("computes IC using Spearman rank correlation", () => {
    // 3 instruments: high momentum → high future return alignment → positive IC
    // bars[5] is "now", bars[6] is the horizon=1 future bar
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 102, 104, 106, 108, 110, 115]),  // momentum +10%, future +4.5%
      makeInstrument("B.X", [100, 101, 102, 103, 104, 105, 107]),  // momentum +5%, future +1.9%
      makeInstrument("C.X", [100,  99,  98,  97,  96,  95,  94]),  // momentum -5%, future -1.1%
    ];
    const result = computeFactor(instruments, "momentum", 5, 1);
    expect(result.ic).not.toBeNull();
    expect(result.ic!).toBeGreaterThan(0);
  });

  it("computes volatility factor", () => {
    // High-vol instrument: large swings
    const instruments: InstrumentBars[] = [
      makeInstrument("A.X", [100, 110, 95, 115, 90, 120]),  // large swings
      makeInstrument("B.X", [100, 100.1, 99.9, 100.1, 99.9, 100]),  // near flat
    ];
    const result = computeFactor(instruments, "volatility", 5, 0);
    // volatility factor: high-vol stock should have higher factor value
    const aVol = result.values.find(v => v.instrumentId === "A.X")!.value;
    const bVol = result.values.find(v => v.instrumentId === "B.X")!.value;
    expect(aVol).not.toBeNull();
    expect(bVol).not.toBeNull();
    expect(aVol!).toBeGreaterThan(bVol!);
  });
});
