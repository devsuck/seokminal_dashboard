import { describe, it, expect, vi, afterEach } from "vitest";
import { getOrderflowSymbols, getOrderflowHistoryDates, getOrderflowHistory, ApiError } from "../../lib/api";

describe("getOrderflowSymbols", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the symbols list on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: ["BTC.HL", "NQ"] }),
    } as Response);
    const result = await getOrderflowSymbols();
    expect(result).toEqual({ symbols: ["BTC.HL", "NQ"] });
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);
    await expect(getOrderflowSymbols()).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);
    const ctrl = new AbortController();
    await getOrderflowSymbols(ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});

describe("getOrderflowHistoryDates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits the /dates endpoint and returns the date list", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: "BTC.HL", dates: ["2026-07-28", "2026-07-29"] }),
    } as Response);
    const result = await getOrderflowHistoryDates("BTC.HL");
    expect(result.dates).toEqual(["2026-07-28", "2026-07-29"]);
    expect(fetchSpy.mock.calls[0][0]).toContain("/orderflow/history/BTC.HL/dates");
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "no snapshot history" }),
    } as Response);
    await expect(getOrderflowHistoryDates("NQ")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getOrderflowHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the query string from date/start/end/limit", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: "BTC.HL", date: "2026-07-29", snapshots: [], truncated: false }),
    } as Response);
    await getOrderflowHistory("BTC.HL", "2026-07-29", { start: 100, end: 200, limit: 50 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/orderflow/history/BTC.HL");
    expect(url.searchParams.get("date")).toBe("2026-07-29");
    expect(url.searchParams.get("start")).toBe("100");
    expect(url.searchParams.get("end")).toBe("200");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("omits start/end/limit when not provided", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: "BTC.HL", date: "2026-07-29", snapshots: [], truncated: false }),
    } as Response);
    await getOrderflowHistory("BTC.HL", "2026-07-29");
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.has("start")).toBe(false);
    expect(url.searchParams.has("limit")).toBe(false);
  });

  it("returns the parsed snapshots on success", async () => {
    const body = {
      symbol: "BTC.HL",
      date: "2026-07-29",
      snapshots: [{ ts: 1.0, bids: [[100, 1]], asks: [[101, 2]] }],
      truncated: false,
    };
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => body } as Response);
    const result = await getOrderflowHistory("BTC.HL", "2026-07-29");
    expect(result).toEqual(body);
  });
});
