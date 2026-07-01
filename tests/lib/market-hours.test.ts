import { describe, it, expect } from "vitest";
import { isUSMarketOpen } from "../../lib/market-hours";

// UTC instants chosen so their ET wall-clock is unambiguous.
// Summer (EDT, UTC-4): 2026-07-01 is a Wednesday.
// 14:00 UTC = 10:00 EDT (open), 21:00 UTC = 17:00 EDT (closed), 12:00 UTC = 08:00 EDT (pre-open)
describe("isUSMarketOpen", () => {
  it("open during regular hours (Wed 10:00 EDT)", () => {
    expect(isUSMarketOpen(new Date("2026-07-01T14:00:00Z"))).toBe(true);
  });

  it("closed after 16:00 ET (Wed 17:00 EDT)", () => {
    expect(isUSMarketOpen(new Date("2026-07-01T21:00:00Z"))).toBe(false);
  });

  it("closed before 09:30 ET (Wed 08:00 EDT)", () => {
    expect(isUSMarketOpen(new Date("2026-07-01T12:00:00Z"))).toBe(false);
  });

  it("closed on weekend (Sat 12:00 EDT)", () => {
    expect(isUSMarketOpen(new Date("2026-07-04T16:00:00Z"))).toBe(false);
  });

  it("open right at 09:30 ET (Wed)", () => {
    // 13:30 UTC = 09:30 EDT
    expect(isUSMarketOpen(new Date("2026-07-01T13:30:00Z"))).toBe(true);
  });

  it("handles winter EST (UTC-5): 15:00 UTC = 10:00 EST open", () => {
    // 2026-01-07 is a Wednesday
    expect(isUSMarketOpen(new Date("2026-01-07T15:00:00Z"))).toBe(true);
    // 14:00 UTC = 09:00 EST → closed (pre-open)
    expect(isUSMarketOpen(new Date("2026-01-07T14:00:00Z"))).toBe(false);
  });
});
