import { describe, it, expect, beforeEach } from "vitest";
import { getOrderLog, addOrderEntry, updateOrderStatus, clearOrderLog, STORAGE_KEY, type OrderLogEntry } from "../../lib/order-storage";

beforeEach(() => {
  localStorage.clear();
});

describe("getOrderLog", () => {
  it("returns [] when storage is empty", () => {
    expect(getOrderLog()).toEqual([]);
  });

  it("returns [] when storage contains invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "bad");
    expect(getOrderLog()).toEqual([]);
  });
});

describe("addOrderEntry", () => {
  it("appends entry with generated id and submitted_at", () => {
    const result = addOrderEntry({
      venue: "KR",
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
    addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    const result = addOrderEntry({ venue: "KR", code: "000660", side: "SELL", qty: 2, order_type: "MARKET", order_id: "002", status: "SUBMITTED" });
    expect(result).toHaveLength(2);
  });

  it("persists entries across getOrderLog calls", () => {
    addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    expect(getOrderLog()).toHaveLength(1);
  });
});

describe("clearOrderLog", () => {
  it("empties the order log", () => {
    addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });

  it("is a no-op when already empty", () => {
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });
});

describe("venue field", () => {
  it("addOrderEntry stores venue KR", () => {
    const result = addOrderEntry({
      venue: "KR",
      code: "005930", side: "BUY", qty: 1, order_type: "MARKET",
      order_id: "001", status: "SUBMITTED",
    });
    expect(result[0].venue).toBe("KR");
  });

  it("addOrderEntry stores venue US", () => {
    const result = addOrderEntry({
      venue: "US",
      code: "AAPL", side: "BUY", qty: 1, order_type: "MARKET",
      order_id: "42", status: "PendingSubmit",
    });
    expect(result[0].venue).toBe("US");
  });
});

describe("updateOrderStatus", () => {
  it("updates status of matching entry", () => {
    const entries = addOrderEntry({
      venue: "KR", code: "005930", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "001", status: "SUBMITTED",
    });
    const id = entries[0].id;
    const updated = updateOrderStatus(id, "CANCELLED");
    expect(updated.find(e => e.id === id)?.status).toBe("CANCELLED");
  });

  it("is a no-op if id not found", () => {
    addOrderEntry({
      venue: "KR", code: "005930", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "001", status: "SUBMITTED",
    });
    const result = updateOrderStatus("nonexistent", "CANCELLED");
    expect(result[0].status).toBe("SUBMITTED");
  });

  it("persists update across getOrderLog calls", () => {
    const entries = addOrderEntry({
      venue: "US", code: "AAPL", side: "BUY", qty: 1,
      order_type: "MARKET", order_id: "42", status: "PendingSubmit",
    });
    const id = entries[0].id;
    updateOrderStatus(id, "Filled");
    expect(getOrderLog().find(e => e.id === id)?.status).toBe("Filled");
  });

  it("returns updated list", () => {
    addOrderEntry({ venue: "KR", code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    const entries = addOrderEntry({ venue: "KR", code: "000660", side: "SELL", qty: 2, order_type: "MARKET", order_id: "002", status: "SUBMITTED" });
    const id = entries[0].id;
    const updated = updateOrderStatus(id, "CANCELLED");
    expect(updated).toHaveLength(2);
  });
});
