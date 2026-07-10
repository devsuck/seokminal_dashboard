import { describe, it, expect, vi, afterEach } from "vitest";
import { getOptionsGex, ApiError } from "../../lib/api";

describe("getOptionsGex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const snapshot = {
    currency: "BTC",
    spot: 95000,
    updated_at: 1720000000,
    levels: [{ strike: 100000, call_gex: 1.5, put_gex: 0.5, net_gex: 1.0 }],
  };

  it("returns the GEX snapshot on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const result = await getOptionsGex("BTC");
    expect(result).toEqual(snapshot);
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);
    await expect(getOptionsGex("BTC")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const ctrl = new AbortController();
    await getOptionsGex("BTC", ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});
