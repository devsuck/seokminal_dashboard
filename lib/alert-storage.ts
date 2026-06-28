import type { TriggeredAlert } from "./api";

const TRIGGERED_KEY = "seokminal_triggered_alerts";
const MAX_STORED = 100;

export function getCachedTriggered(): TriggeredAlert[] {
  try {
    return JSON.parse(localStorage.getItem(TRIGGERED_KEY) ?? "[]") as TriggeredAlert[];
  } catch {
    return [];
  }
}

export function mergeTriggered(incoming: TriggeredAlert[]): TriggeredAlert[] {
  const existing = getCachedTriggered();
  const seen = new Set(existing.map(e => `${e.rule_id}|${e.triggered_at}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.rule_id}|${item.triggered_at}`;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }
  merged.sort((a, b) => b.triggered_at.localeCompare(a.triggered_at));
  const capped = merged.slice(0, MAX_STORED);
  localStorage.setItem(TRIGGERED_KEY, JSON.stringify(capped));
  return capped;
}

export function clearCachedTriggered(): void {
  localStorage.setItem(TRIGGERED_KEY, "[]");
}
