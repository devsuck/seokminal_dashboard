import { describe, it, expect, beforeEach } from "vitest";
import { getOrderLog, addOrderEntry, clearOrderLog, type OrderLogEntry } from "../../lib/order-storage";

beforeEach(() => {
  localStorage.clear();
});

describe("getOrderLog", () => {
  it("returns [] when storage is empty", () => {
    expect(getOrderLog()).toEqual([]);
  });

  it("returns [] when storage contains invalid JSON", () => {
    localStorage.setItem("nautilus_order_log", "bad");
    expect(getOrderLog()).toEqual([]);
  });
});

describe("addOrderEntry", () => {
  it("appends entry with generated id and submitted_at", () => {
    const result = addOrderEntry({
      code: "005930",
      side: "BUY",
      qty: 1,
      order_type: "MARKET",
      order_id: "0001234",
      status: "SUBMITTED",
    });
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("005930");
    expect(result[0].id).toBeTruthy();
    expect(result[0].submitted_at).toBeTruthy();
  });

  it("returns updated list with multiple entries", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    const result = addOrderEntry({ code: "000660", side: "SELL", qty: 2, order_type: "MARKET", order_id: "002", status: "SUBMITTED" });
    expect(result).toHaveLength(2);
  });

  it("persists entries across getOrderLog calls", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    expect(getOrderLog()).toHaveLength(1);
  });
});

describe("clearOrderLog", () => {
  it("empties the order log", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });

  it("is a no-op when already empty", () => {
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });
});
