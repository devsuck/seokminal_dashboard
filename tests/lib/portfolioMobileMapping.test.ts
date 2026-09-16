import { describe, it, expect } from "vitest";
import { alpacaToMobile, hlToMobile, kisToMobile } from "@/app/portfolio/page";
import type { AlpacaPosition, HLAssetPosition, KISHolding } from "@/lib/api";

describe("alpacaToMobile", () => {
  it("return% 필드를 100배해 pnlPct로 변환한다", () => {
    const p: AlpacaPosition = {
      symbol: "AAPL", qty: 10, side: "long", avg_entry_price: 150, current_price: 165,
      unrealized_pl: 150, unrealized_plpc: 0.1, market_value: 1650,
    };
    const m = alpacaToMobile(p);
    expect(m.symbol).toBe("AAPL");
    expect(m.pnlPct).toBeCloseTo(10);
    expect(m.avgPrice).toBe("$150.00");
  });
});

describe("hlToMobile", () => {
  it("returnOnEquity(비율)를 100배해 pnlPct로 변환한다", () => {
    const p: HLAssetPosition = {
      position: {
        coin: "BTC", szi: "0.5", entryPx: "60000", positionValue: "31000",
        unrealizedPnl: "1000", returnOnEquity: "0.05",
      },
    } as HLAssetPosition;
    const m = hlToMobile(p, "HL 테스트넷");
    expect(m.symbol).toBe("BTC");
    expect(m.pnlPct).toBeCloseTo(5);
    expect(m.venue).toBe("HL 테스트넷");
  });
});

describe("kisToMobile", () => {
  it("return_pct가 없으면 pnlPct 0으로 fallback한다", () => {
    const h: KISHolding = {
      code: "005930", name: "삼성전자", qty: 10, avg_price: 70000, current: 72000, return_pct: null,
    } as KISHolding;
    const m = kisToMobile(h, "한투 모의");
    expect(m.pnlPct).toBe(0);
    expect(m.symbol).toBe("삼성전자");
  });
});
