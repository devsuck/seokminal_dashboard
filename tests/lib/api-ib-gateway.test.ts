import { describe, it, expect, vi, afterEach } from "vitest";
import { getIBGatewayStatus } from "@/lib/api";

describe("getIBGatewayStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the connected status from the API response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        last_auth_ts: "2026-09-14T01:00:00Z",
        next_reset_eta: "2026-09-21T01:00:00Z",
        needs_manual_action: false,
      }),
    } as Response);

    const status = await getIBGatewayStatus();

    expect(status.connected).toBe(true);
    expect(status.needs_manual_action).toBe(false);
  });

  it("surfaces needs_manual_action when reauth is required", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: false,
        last_auth_ts: null,
        next_reset_eta: null,
        needs_manual_action: true,
      }),
    } as Response);

    const status = await getIBGatewayStatus();

    expect(status.connected).toBe(false);
    expect(status.needs_manual_action).toBe(true);
  });

  it("throws when the backend responds with an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);

    await expect(getIBGatewayStatus()).rejects.toThrow();
  });
});
