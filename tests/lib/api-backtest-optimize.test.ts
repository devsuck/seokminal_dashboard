import { describe, it, expect, vi, afterEach } from "vitest";
import { runBacktestOptimize, ApiError } from "../../lib/api";

describe("runBacktestOptimize", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns OptimizeResponse on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        best_params: { fast: 10, slow: 24, signal_period: 9, trade_size: 10 },
        best_sharpe: 0.83,
        combinations_tested: 27,
      }),
    } as Response);
    const result = await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "macd");
    expect(result.best_sharpe).toBe(0.83);
    expect(result.combinations_tested).toBe(27);
    expect(result.best_params.fast).toBe(10);
  });

  it("throws ApiError on 400", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ detail: "optimize only supports 'macd' or 'rsi'" }),
    } as Response);
    await expect(runBacktestOptimize("X", "2024-01-01", "2024-12-31", "rsi")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ best_params: {}, best_sharpe: null, combinations_tested: 0 }),
    } as Response);
    const ctrl = new AbortController();
    await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "macd", ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });

  it("includes strategy in URL", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ best_params: {}, best_sharpe: null, combinations_tested: 0 }),
    } as Response);
    await runBacktestOptimize("AAPL.NASDAQ", "2024-01-01", "2024-12-31", "rsi");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("strategy=rsi");
  });
});
