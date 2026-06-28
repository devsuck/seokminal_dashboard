import { describe, it, expect, beforeEach } from "vitest";
import { listSavedRules, saveRule, deleteRule, type SavedSpawnRule } from "../../lib/spawner-storage";

beforeEach(() => {
  localStorage.clear();
});

describe("listSavedRules", () => {
  it("returns [] when storage is empty", () => {
    expect(listSavedRules()).toEqual([]);
  });

  it("returns [] when storage contains invalid JSON", () => {
    localStorage.setItem("nautilus_spawn_rules", "not-json");
    expect(listSavedRules()).toEqual([]);
  });
});

describe("saveRule", () => {
  it("appends a new rule and returns updated list", () => {
    const result = saveRule("Rule A", "[{}]");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rule A");
    expect(result[0].json).toBe("[{}]");
    expect(result[0].savedAt).toBeTruthy();
  });

  it("replaces existing rule with same name", () => {
    saveRule("Rule A", "[{}]");
    const result = saveRule("Rule A", "[{updated: true}]");
    expect(result).toHaveLength(1);
    expect(result[0].json).toBe("[{updated: true}]");
  });

  it("persists rules across listSavedRules calls", () => {
    saveRule("Rule A", "[{}]");
    saveRule("Rule B", "[{}]");
    expect(listSavedRules()).toHaveLength(2);
  });
});

describe("deleteRule", () => {
  it("removes a rule by name", () => {
    saveRule("Rule A", "[{}]");
    saveRule("Rule B", "[{}]");
    const result = deleteRule("Rule A");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rule B");
  });

  it("is a no-op when name not found", () => {
    saveRule("Rule A", "[{}]");
    const result = deleteRule("Rule X");
    expect(result).toHaveLength(1);
  });
});
