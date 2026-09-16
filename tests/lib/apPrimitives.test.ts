import { describe, it, expect } from "vitest";
import { hashHue, gainBarWidthPct } from "@/components/ui/ApPrimitives";

describe("hashHue", () => {
  it("같은 심볼은 항상 같은 hue를 반환한다", () => {
    expect(hashHue("AAPL")).toBe(hashHue("AAPL"));
  });
  it("0~359 범위 안에 있다", () => {
    for (const s of ["AAPL", "005930", "BTC", "a", ""]) {
      const h = hashHue(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
  it("서로 다른 심볼은 (대개) 다른 hue를 반환한다", () => {
    expect(hashHue("AAPL")).not.toBe(hashHue("MSFT"));
  });
});

describe("gainBarWidthPct", () => {
  it("maxAbs와 같은 크기면 100을 반환한다", () => {
    expect(gainBarWidthPct(5, 5)).toBe(100);
    expect(gainBarWidthPct(-5, 5)).toBe(100);
  });
  it("0..100 범위로 클램프한다", () => {
    expect(gainBarWidthPct(10, 5)).toBe(100);
    expect(gainBarWidthPct(0, 5)).toBe(0);
  });
  it("maxAbs가 0이어도 나눗셈 에러 없이 동작한다", () => {
    expect(Number.isFinite(gainBarWidthPct(3, 0))).toBe(true);
  });
});
