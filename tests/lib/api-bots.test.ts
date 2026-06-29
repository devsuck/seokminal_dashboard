import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBot, fetchBotTrades, fetchBotSignals, ApiError } from "../../lib/api";

const BOT_ID = "bot123";

describe("getBot", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns BotRecord on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: BOT_ID, name: "MyBot", strategy: "ema_cross",
        instrument_id: "AAPL.NASDAQ", fast_ema: 10, slow_ema: 20,
        trade_size: 5, status: "running", created_at: "2026-01-01T00:00:00Z",
      }),
    } as Response);
    const bot = await getBot(BOT_ID);
    expect(bot.id).toBe(BOT_ID);
    expect(bot.name).toBe("MyBot");
  });

  it("throws ApiError on 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ detail: "bot not found" }),
    } as Response);
    await expect(getBot("bad")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchBotTrades", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns empty trades list", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ bot_id: BOT_ID, trades: [] }),
    } as Response);
    const result = await fetchBotTrades(BOT_ID);
    expect(result.bot_id).toBe(BOT_ID);
    expect(result.trades).toHaveLength(0);
  });

  it("returns trades with pnl", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        bot_id: BOT_ID,
        trades: [{
          entry_ts_ns: 1000000000, exit_ts_ns: 2000000000,
          side: "LONG", entry_price: 100.0, exit_price: 110.0, qty: 5, pnl: 50.0,
        }],
      }),
    } as Response);
    const result = await fetchBotTrades(BOT_ID);
    expect(result.trades[0].pnl).toBe(50.0);
    expect(result.trades[0].side).toBe("LONG");
  });
});

describe("fetchBotSignals", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns signal entries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        bot_id: BOT_ID,
        signals: [{ ts_ns: 1000000000, signal: "EMA_BUY", price: 150.0 }],
      }),
    } as Response);
    const result = await fetchBotSignals(BOT_ID);
    expect(result.signals[0].signal).toBe("EMA_BUY");
    expect(result.signals[0].price).toBe(150.0);
  });
});
