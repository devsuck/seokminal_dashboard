import { describe, it, expect, vi, afterEach } from "vitest";

// getFxRate() is imported fresh per test via vi.resetModules() + dynamic import.
// Reason: its 24h cache lives in a module-scope variable, so a static top-level
// import would share one cache instance across all it() blocks below — the fixed
// timestamps in these tests (chosen to hit exact TTL boundaries) then become
// order-dependent on leftover cache state from whichever test ran previously.
async function freshGetFxRate() {
  vi.resetModules();
  const mod = await import("@/lib/api");
  return mod.getFxRate;
}

describe("getFxRate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns usdkrw from the FX API response", async () => {
    const getFxRate = await freshGetFxRate();
    vi.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00Z"));
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { KRW: 1350.5 } }),
    } as Response);
    const rate = await getFxRate();
    expect(rate.usdkrw).toBe(1350.5);
  });

  it("reuses the cached rate within 24h without refetching", async () => {
    const getFxRate = await freshGetFxRate();
    vi.useFakeTimers().setSystemTime(new Date("2026-01-02T00:00:00Z"));
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { KRW: 1400 } }),
    } as Response);
    await getFxRate();
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    await getFxRate();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refetches after the 24h cache expires", async () => {
    const getFxRate = await freshGetFxRate();
    vi.useFakeTimers().setSystemTime(new Date("2026-01-03T00:00:00Z"));
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { KRW: 1420 } }),
    } as Response);
    await getFxRate();
    vi.setSystemTime(new Date("2026-01-04T00:00:01Z"));
    await getFxRate();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws when the FX API responds with an error", async () => {
    const getFxRate = await freshGetFxRate();
    vi.useFakeTimers().setSystemTime(new Date("2026-01-05T00:00:00Z"));
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ "error-type": "quota-reached" }),
    } as Response);
    await expect(getFxRate()).rejects.toThrow();
  });
});
