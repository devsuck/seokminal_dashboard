import type { SpawnRuleState } from "@/lib/backtest-types";

const STORAGE_KEY = "nautilus:strategies";
const MAX_STRATEGIES = 200;

export interface EmaParams   { type: "ema_cross"; fast: number; slow: number; }
export interface GatedParams { type: "gated"; rules: SpawnRuleState[]; }
export type StrategyParams = EmaParams | GatedParams;

export interface StrategyVersion {
  params: StrategyParams;
  savedAt: number;
  note: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  params: StrategyParams;
  versions: StrategyVersion[];
  createdAt: number;
  updatedAt: number;
}

function genId(): string {
  return `strat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getStrategies(): Strategy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Strategy[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getActiveStrategies(): Strategy[] {
  return getStrategies().filter(s => !s.archived);
}

function persist(strategies: Strategy[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies.slice(0, Math.floor(MAX_STRATEGIES / 2))));
    } catch {
      // Storage exhausted — silently skip
    }
  }
}

export function createStrategy(entry: {
  name: string;
  description: string;
  tags: string[];
  params: StrategyParams;
}): Strategy {
  const now = Date.now();
  const strategy: Strategy = {
    id: genId(),
    name: entry.name,
    description: entry.description,
    tags: entry.tags,
    favorite: false,
    archived: false,
    params: entry.params,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
  const existing = getStrategies();
  persist([strategy, ...existing].slice(0, MAX_STRATEGIES));
  return strategy;
}

export function updateStrategyMeta(
  id: string,
  updates: Partial<Pick<Strategy, "name" | "description" | "tags" | "favorite" | "archived">>
): void {
  const strategies = getStrategies().map(s =>
    s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
  );
  persist(strategies);
}

export function updateStrategyParams(
  id: string,
  params: StrategyParams,
  versionNote: string
): void {
  const strategies = getStrategies().map(s => {
    if (s.id !== id) return s;
    const version: StrategyVersion = { params: s.params, savedAt: Date.now(), note: versionNote };
    return { ...s, params, versions: [version, ...s.versions], updatedAt: Date.now() };
  });
  persist(strategies);
}

export function cloneStrategy(id: string, newName: string): Strategy {
  const original = getStrategies().find(s => s.id === id);
  if (!original) throw new Error(`Strategy ${id} not found`);
  const now = Date.now();
  const clone: Strategy = {
    id: genId(),
    name: newName,
    description: original.description,
    tags: [...original.tags],
    favorite: false,
    archived: false,
    params: structuredClone(original.params),
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
  const existing = getStrategies();
  persist([clone, ...existing].slice(0, MAX_STRATEGIES));
  return clone;
}

export function rollbackStrategy(id: string, versionIndex: number): void {
  const strategies = getStrategies().map(s => {
    if (s.id !== id) return s;
    const target = s.versions[versionIndex];
    if (!target) return s;
    const rollbackVersion: StrategyVersion = {
      params: s.params,
      savedAt: Date.now(),
      note: `Rolled back from version ${versionIndex}`,
    };
    const newVersions = [rollbackVersion, ...s.versions];
    return { ...s, params: target.params, versions: newVersions, updatedAt: Date.now() };
  });
  persist(strategies);
}

export function deleteStrategy(id: string): void {
  persist(getStrategies().filter(s => s.id !== id));
}

export function clearStrategies(): void {
  localStorage.removeItem(STORAGE_KEY);
}
