import { describe, it, expect, beforeEach } from "vitest";
import {
  createStrategy, getStrategies, getActiveStrategies,
  updateStrategyMeta, updateStrategyParams, cloneStrategy,
  rollbackStrategy, deleteStrategy, clearStrategies,
  type StrategyParams,
} from "../../lib/strategy-storage";

const EMA_PARAMS: StrategyParams = { type: "ema_cross", fast: 10, slow: 20 };
const EMA_PARAMS_2: StrategyParams = { type: "ema_cross", fast: 5, slow: 30 };

describe("strategy-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getStrategies returns [] when empty", () => {
    expect(getStrategies()).toEqual([]);
  });

  it("getStrategies returns [] on corrupt JSON", () => {
    localStorage.setItem("nautilus:strategies", "NOT_JSON{");
    expect(getStrategies()).toEqual([]);
  });

  it("createStrategy persists and returns strategy with id/timestamps", () => {
    const s = createStrategy({ name: "Test", description: "", tags: [], params: EMA_PARAMS });
    expect(s.id).toMatch(/^strat_\d+_[a-z0-9]{5}$/);
    expect(s.createdAt).toBeGreaterThan(0);
    expect(s.updatedAt).toBeGreaterThan(0);
    expect(s.favorite).toBe(false);
    expect(s.archived).toBe(false);
    expect(s.versions).toHaveLength(0);
    expect(getStrategies()).toHaveLength(1);
  });

  it("createStrategy prepends (newest first)", () => {
    createStrategy({ name: "A", description: "", tags: [], params: EMA_PARAMS });
    createStrategy({ name: "B", description: "", tags: [], params: EMA_PARAMS });
    expect(getStrategies()[0].name).toBe("B");
    expect(getStrategies()[1].name).toBe("A");
  });

  it("getActiveStrategies excludes archived", () => {
    const s = createStrategy({ name: "X", description: "", tags: [], params: EMA_PARAMS });
    updateStrategyMeta(s.id, { archived: true });
    expect(getActiveStrategies()).toHaveLength(0);
    expect(getStrategies()).toHaveLength(1);
  });

  it("updateStrategyMeta updates name/favorite without touching params/versions", () => {
    const s = createStrategy({ name: "Old", description: "", tags: [], params: EMA_PARAMS });
    updateStrategyMeta(s.id, { name: "New", favorite: true });
    const updated = getStrategies().find(x => x.id === s.id)!;
    expect(updated.name).toBe("New");
    expect(updated.favorite).toBe(true);
    expect(updated.params).toEqual(EMA_PARAMS);
    expect(updated.versions).toHaveLength(0);
  });

  it("updateStrategyParams saves old params as version entry", () => {
    const s = createStrategy({ name: "S", description: "", tags: [], params: EMA_PARAMS });
    updateStrategyParams(s.id, EMA_PARAMS_2, "Adjusted fast");
    const updated = getStrategies().find(x => x.id === s.id)!;
    expect(updated.params).toEqual(EMA_PARAMS_2);
    expect(updated.versions).toHaveLength(1);
    expect(updated.versions[0].params).toEqual(EMA_PARAMS);
    expect(updated.versions[0].note).toBe("Adjusted fast");
  });

  it("cloneStrategy creates independent copy with new id and empty versions", () => {
    const s = createStrategy({ name: "Original", description: "desc", tags: ["a"], params: EMA_PARAMS });
    const clone = cloneStrategy(s.id, "Clone of Original");
    expect(clone.id).not.toBe(s.id);
    expect(clone.name).toBe("Clone of Original");
    expect(clone.params).toEqual(EMA_PARAMS);
    expect(clone.versions).toHaveLength(0);
    expect(clone.favorite).toBe(false);
    expect(getStrategies()).toHaveLength(2);
  });

  it("rollbackStrategy sets current params to historical version, saves current as new version", () => {
    const s = createStrategy({ name: "S", description: "", tags: [], params: EMA_PARAMS });
    updateStrategyParams(s.id, EMA_PARAMS_2, "v2");
    // versions[0] = EMA_PARAMS (v1), current = EMA_PARAMS_2
    rollbackStrategy(s.id, 0);
    const updated = getStrategies().find(x => x.id === s.id)!;
    expect(updated.params).toEqual(EMA_PARAMS);
    // versions should now have 2 entries: v1 (prepended rollback record) + original v1
    expect(updated.versions).toHaveLength(2);
  });

  it("deleteStrategy removes by id", () => {
    const s = createStrategy({ name: "del", description: "", tags: [], params: EMA_PARAMS });
    deleteStrategy(s.id);
    expect(getStrategies()).toHaveLength(0);
  });

  it("clearStrategies empties storage", () => {
    createStrategy({ name: "A", description: "", tags: [], params: EMA_PARAMS });
    clearStrategies();
    expect(getStrategies()).toHaveLength(0);
  });

  it("updateStrategyMeta updates updatedAt", () => {
    const s = createStrategy({ name: "T", description: "", tags: [], params: EMA_PARAMS });
    const before = s.updatedAt;
    updateStrategyMeta(s.id, { name: "T2" });
    const after = getStrategies().find(x => x.id === s.id)!.updatedAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
