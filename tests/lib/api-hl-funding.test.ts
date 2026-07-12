import { describe, it, expect, vi, afterEach } from "vitest";
import { getHlFunding, ApiError } from "../../lib/api";

describe("getHlFunding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const snapshot = {
    coin: "BTC",
    funding: 0.0001,
    open_interest: 5000,
    mark_px: 95000,
    prev_day_px: 93000,
    day_ntl_vlm: 5e8,
    updated_at: 1720000000,
  };

  it("returns the funding snapshot on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const result = await getHlFunding("BTC");
    expect(result).toEqual(snapshot);
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);
    await expect(getHlFunding("BTC")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => snapshot,
    } as Response);
    const ctrl = new AbortController();
    await getHlFunding("BTC", ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});
