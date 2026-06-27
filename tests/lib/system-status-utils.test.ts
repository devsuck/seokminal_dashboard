import { describe, it, expect } from "vitest";
import { statusColor, formatLatency } from "../../lib/system-status-utils";

describe("statusColor", () => {
  it("returns text-pos for online", () => {
    expect(statusColor("online")).toBe("text-pos");
  });
  it("returns text-neg for error", () => {
    expect(statusColor("error")).toBe("text-neg");
  });
  it("returns text-warn for checking", () => {
    expect(statusColor("checking")).toBe("text-warn");
  });
});

describe("formatLatency", () => {
  it("formats ms value", () => {
    expect(formatLatency(123)).toBe("123ms");
    expect(formatLatency(0)).toBe("0ms");
  });
  it("returns dash for null", () => {
    expect(formatLatency(null)).toBe("—");
  });
});
