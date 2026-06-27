import { describe, it, expect, beforeEach } from "vitest";
import { logActivity, getRecentActivity, clearActivity } from "../../lib/dashboard-storage";

describe("dashboard-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves an activity entry", () => {
    logActivity({ type: "backtest", label: "AAPL EMA 10/20", href: "/backtest" });
    const result = getRecentActivity();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("backtest");
    expect(result[0].label).toBe("AAPL EMA 10/20");
    expect(result[0].href).toBe("/backtest");
    expect(typeof result[0].id).toBe("string");
    expect(result[0].id.length).toBeGreaterThan(0);
    expect(typeof result[0].timestamp).toBe("number");
  });

  it("returns entries newest-first", () => {
    logActivity({ type: "backtest", label: "First", href: "/backtest" });
    logActivity({ type: "strategy", label: "Second", href: "/quant" });
    const result = getRecentActivity();
    expect(result[0].label).toBe("Second");
    expect(result[1].label).toBe("First");
  });

  it("caps stored entries at 50", () => {
    for (let i = 0; i < 55; i++) {
      logActivity({ type: "backtest", label: `Run ${i}`, href: "/backtest" });
    }
    expect(getRecentActivity().length).toBe(50);
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      logActivity({ type: "backtest", label: `Run ${i}`, href: "/backtest" });
    }
    expect(getRecentActivity(3)).toHaveLength(3);
  });

  it("clearActivity empties the log", () => {
    logActivity({ type: "backtest", label: "X", href: "/backtest" });
    clearActivity();
    expect(getRecentActivity()).toHaveLength(0);
  });

  it("returns empty array when localStorage is empty", () => {
    expect(getRecentActivity()).toHaveLength(0);
  });
});
