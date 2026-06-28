export interface SavedSpawnRule {
  name: string;
  json: string;
  savedAt: string;
}

const STORAGE_KEY = "nautilus_spawn_rules";

export function listSavedRules(): SavedSpawnRule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedSpawnRule[];
  } catch {
    return [];
  }
}

export function saveRule(name: string, json: string): SavedSpawnRule[] {
  const rules = listSavedRules();
  const idx = rules.findIndex(r => r.name === name);
  const entry: SavedSpawnRule = { name, json, savedAt: new Date().toISOString() };
  if (idx >= 0) {
    rules[idx] = entry;
  } else {
    rules.push(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  return rules;
}

export function deleteRule(name: string): SavedSpawnRule[] {
  const rules = listSavedRules().filter(r => r.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  return rules;
}
