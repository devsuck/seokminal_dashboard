import { describe, it, expect, vi, afterEach } from "vitest";
import { getOrderflowSymbols, ApiError } from "../../lib/api";

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
