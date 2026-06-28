import { describe, it, expect, beforeEach } from "vitest";
import { getCachedTriggered, mergeTriggered, clearCachedTriggered } from "../../lib/alert-storage";
import type { TriggeredAlert } from "../../lib/api";

function makeAlert(ruleId: string, ts: string): TriggeredAlert {
  return {
    rule_id: ruleId,
    rule_label: "Test Rule",
    condition_type: "bot_stopped",
    bot_id: "bot1",
    detail: "bot not running",
    triggered_at: ts,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("getCachedTriggered", () => {
  it("returns empty array when nothing cached", () => {
    expect(getCachedTriggered()).toEqual([]);
  });

  it("returns stored triggered alerts", () => {
    const alerts = [makeAlert("r1", "2026-06-29T10:00:00+00:00")];
    localStorage.setItem("seokminal_triggered_alerts", JSON.stringify(alerts));
    expect(getCachedTriggered()).toHaveLength(1);
  });
});

describe("mergeTriggered", () => {
  it("stores incoming alerts", () => {
    const result = mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    expect(result).toHaveLength(1);
    expect(getCachedTriggered()).toHaveLength(1);
  });

  it("deduplicates by rule_id + triggered_at", () => {
    const alert = makeAlert("r1", "2026-06-29T10:00:00+00:00");
    mergeTriggered([alert]);
    const result = mergeTriggered([alert]);
    expect(result).toHaveLength(1);
  });

  it("merges new alerts with existing ones", () => {
    mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    const result = mergeTriggered([makeAlert("r2", "2026-06-29T11:00:00+00:00")]);
    expect(result).toHaveLength(2);
  });

  it("sorts by triggered_at descending", () => {
    const result = mergeTriggered([
      makeAlert("r1", "2026-06-29T09:00:00+00:00"),
      makeAlert("r2", "2026-06-29T11:00:00+00:00"),
      makeAlert("r3", "2026-06-29T10:00:00+00:00"),
    ]);
    expect(result[0].rule_id).toBe("r2");
    expect(result[1].rule_id).toBe("r3");
    expect(result[2].rule_id).toBe("r1");
  });

  it("caps stored alerts at 100", () => {
    const alerts = Array.from({ length: 105 }, (_, i) =>
      makeAlert(`r${i}`, `2026-06-29T${String(i).padStart(2, "0")}:00:00+00:00`),
    );
    const result = mergeTriggered(alerts);
    expect(result).toHaveLength(100);
  });
});

describe("clearCachedTriggered", () => {
  it("removes all cached triggered alerts", () => {
    mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    clearCachedTriggered();
    expect(getCachedTriggered()).toEqual([]);
  });
});
