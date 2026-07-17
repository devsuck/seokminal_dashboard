import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBarsForSymbol } from "../../lib/chart-bars";

describe("fetchBarsForSymbol", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("HL 심볼은 getCryptoCandles를 호출하고 BarOut으로 변환한다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        coin: "BTC",
        interval: "1m",
        candles: [{ time_ms: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, num_trades: 3 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("BTC.HL", "1m", new AbortController().signal);
    expect(bars).toEqual([{ ts_event: 1000 * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
  });

  it("XKRX 심볼 + 인트라데이 타임프레임은 에러를 던진다", async () => {
    await expect(
      fetchBarsForSymbol("005930.XKRX", "1m", new AbortController().signal)
    ).rejects.toThrow("KR 인트라데이는 아직 미지원");
  });

  it("XKRX 심볼 + 일봉은 getKRBars를 호출하고 BarOut으로 변환한다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "005930",
        bars: [{ date: "20260101", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("005930.XKRX", "1d", new AbortController().signal);
    expect(bars).toEqual([
      { ts_event: new Date("2026-01-01").getTime() * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    ]);
  });

  it("빈 응답이면 에러를 던진다", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ coin: "BTC", interval: "1m", candles: [] }),
    } as Response);
    await expect(
      fetchBarsForSymbol("BTC.HL", "1m", new AbortController().signal)
    ).rejects.toThrow("빈 응답");
  });

  it("일봉이 아닌 IB 선물 심볼(NQ)은 getIBBars를 asset_type=future+exchange=CME로 호출한다", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "NQ",
        bars: [{ ts_ms: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("NQ", "1m", new AbortController().signal);
    expect(bars).toEqual([{ ts_event: 1000 * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("asset_type=future");
    expect(calledUrl).toContain("exchange=CME");
  });

  it("일봉이 아닌 IB 주식 심볼(AAPL)은 getIBBars를 asset_type=stock으로 호출한다", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "AAPL",
        bars: [{ ts_ms: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
      }),
    } as Response);
    const bars = await fetchBarsForSymbol("AAPL", "1m", new AbortController().signal);
    expect(bars).toEqual([{ ts_event: 1000 * 1_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("asset_type=stock");
  });
});
