import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCorrelation, ApiError } from "../../lib/api";

const MOCK_PAIRS = [
  { a: "AAPL.NASDAQ", b: "MSFT.NASDAQ", correlation: 0.82 },
  { a: "AAPL.NASDAQ", b: "005930.XKRX", correlation: -0.21 },
];

describe("getCorrelation", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ pairs: MOCK_PAIRS }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns pairs from API", async () => {
    const result = await getCorrelation(
      ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"],
      "2025-01-01",
      "2026-01-01",
    );
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs[0].correlation).toBe(0.82);
    expect(result.pairs[1].a).toBe("AAPL.NASDAQ");
  });

  it("joins instrument_ids with comma in URL", async () => {
    await getCorrelation(
      ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"],
      "2025-01-01",
      "2026-01-01",
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("instrument_ids=AAPL.NASDAQ%2CMSFT.NASDAQ%2C005930.XKRX");
    expect(url).toContain("start=2025-01-01");
    expect(url).toContain("end=2026-01-01");
  });

  it("passes signal to fetch", async () => {
    const ctrl = new AbortController();
    await getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01", ctrl.signal);
    const opts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(opts?.signal).toBe(ctrl.signal);
  });

  it("throws ApiError on 400 response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "no bars found for AAPL.NASDAQ" }),
    } as Response);
    await expect(
      getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01"),
    ).rejects.toThrow("no bars found for AAPL.NASDAQ");
  });

  it("throws ApiError on 500 response using statusText fallback", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);
    await expect(
      getCorrelation(["AAPL.NASDAQ"], "2025-01-01", "2026-01-01"),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
