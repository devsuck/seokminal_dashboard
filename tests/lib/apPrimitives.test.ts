import { describe, it, expect } from "vitest";
import { hashHue } from "@/components/ui/ApPrimitives";

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
