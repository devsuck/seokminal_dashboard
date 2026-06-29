import { describe, it, expect, vi, afterEach } from "vitest";
import { runPortfolioBacktest, ApiError } from "../../lib/api";

const MOCK_RESPONSE = {
  results: [
    {
      instrument_id: "AAPL.NASDAQ",
      sharpe_ratio: 1.2,
      total_pnl: 500.0,
      total_pnl_pct: 0.05,
      max_drawdown: -0.1,
      win_rate: 0.6,
      trade_count: 5,
      bar_count: 250,
    },
  ],
  portfolio_equity: [
    { ts_ns: 1704067200000000000, equity: 0.0 },
    { ts_ns: 1704153600000000000, equity: 500.0 },
  ],
  portfolio_total_pnl: 500.0,
  portfolio_max_drawdown: null,
  portfolio_sharpe: null,
};

afterEach(() => vi.restoreAllMocks());

describe("runPortfolioBacktest", () => {
  it("parses a successful response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const result = await runPortfolioBacktest(
      ["AAPL.NASDAQ"],
      "2024-01-01",
      "2024-12-31",
      "macd",
      { fast: "12", slow: "26", signal_period: "9" }
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].instrument_id).toBe("AAPL.NASDAQ");
    expect(result.portfolio_equity[0].equity).toBe(0.0);
    expect(result.portfolio_total_pnl).toBe(500.0);
  });

  it("joins instrumentIds with comma in URL", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    await runPortfolioBacktest(
      ["AAPL.NASDAQ", "SPY.ARCA"],
      "2024-01-01",
      "2024-12-31",
      "rsi",
      {}
    );
    const url = (spy.mock.calls[0][0] as string);
    expect(url).toContain("instrument_ids=AAPL.NASDAQ%2CSPY.ARCA");
    expect(url).toContain("strategy=rsi");
  });

  it("throws ApiError on non-2xx response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "bad strategy" }), { status: 400 })
    );
    await expect(
      runPortfolioBacktest(["AAPL.NASDAQ"], "2024-01-01", "2024-12-31", "gated", {})
    ).rejects.toThrow(ApiError);
  });

  it("passes AbortSignal to fetch", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const ctrl = new AbortController();
    await runPortfolioBacktest(["AAPL.NASDAQ"], "2024-01-01", "2024-12-31", "macd", {}, ctrl.signal);
    expect((spy.mock.calls[0][1] as RequestInit).signal).toBe(ctrl.signal);
  });
});
