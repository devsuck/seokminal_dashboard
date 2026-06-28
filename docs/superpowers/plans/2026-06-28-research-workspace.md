# Research Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two independent research tools — a Strategy Repository (save, clone, version, compare EMA/Gated strategies) and a Research Notebook (block-based notes with chart/metric/table/image/comment blocks) — each as a standalone page.

**Architecture:** `lib/strategy-storage.ts` and `lib/notebook-storage.ts` are the data layers (localStorage, max 200/100 items). Strategy components live in `components/strategies/`, notebook components in `components/notebooks/`. Both get standalone pages (`/strategies`, `/notebooks`) and nav items. The backtest page gains a "Save Strategy" button that persists current params to the strategy store.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4, localStorage, lightweight-charts 5.2.0 (chart blocks), vitest/jsdom (tests).

## Global Constraints

- `"use client"` — ONLY on components that use hooks/browser APIs; Server Components must NOT have it
- CSS tokens ONLY in className: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent`/`text-accent` (#FF9F1C): ONLY on primary action buttons (Save, Create, Run) and active tab underlines; NOT on status badges or data cells
- Inline styles: forbidden — **EXCEPTION:** lightweight-charts chart block `backgroundColor` and color options config, plus series color config (hex in JS only)
- No raw `fetch()` — all API calls via `lib/api.ts` functions
- Strategy storage key: `"nautilus:strategies"` (exact)
- Notebook storage key: `"nautilus:notebooks"` (exact)
- Max strategies: `200`; max notebooks: `100`
- Strategy id format: `` `strat_${Date.now()}_${Math.random().toString(36).slice(2,7)}` ``
- Notebook id format: `` `nb_${Date.now()}_${Math.random().toString(36).slice(2,7)}` ``
- Block entry id format: `` `blk_${Date.now()}_${Math.random().toString(36).slice(2,7)}` ``
- Version entry timestamps: `Date.now()`
- `SpawnRuleState` type imported from `@/lib/backtest-types` (do NOT redefine)
- lightweight-charts v5 API: `chart.addSeries(LineSeries, opts)`, data timestamp: `Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp`
- Test runner: `npm test` (vitest + jsdom)
- Existing 37 tests must continue to pass after every task

## File Map

**Created:**
- `lib/strategy-storage.ts`
- `tests/lib/strategy-storage.test.ts`
- `lib/notebook-storage.ts`
- `tests/lib/notebook-storage.test.ts`
- `components/strategies/StrategyCard.tsx`
- `components/strategies/StrategyCompare.tsx`
- `components/strategies/SaveStrategyForm.tsx`
- `app/strategies/page.tsx`
- `components/notebooks/NoteBlockRenderer.tsx`
- `components/notebooks/NoteBlockEditor.tsx`
- `components/notebooks/NotebookEditor.tsx`
- `app/notebooks/page.tsx`

**Modified:**
- `app/backtest/page.tsx` — add Save Strategy button + SaveStrategyForm
- `app/layout.tsx` — add Strategies + Notebooks nav items
- `docs/progress.md`

---

### Task 1: lib/strategy-storage.ts + tests

**Files:**
- Create: `lib/strategy-storage.ts`
- Create: `tests/lib/strategy-storage.test.ts`

**Interfaces — Produces (Tasks 3, 4 depend on these exact names):**
```typescript
import type { SpawnRuleState } from "@/lib/backtest-types";

export interface EmaParams  { type: "ema_cross"; fast: number; slow: number; }
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
  versions: StrategyVersion[];   // newest first; entry[0] = most recent snapshot before current
  createdAt: number;
  updatedAt: number;
}

// Functions:
export function createStrategy(entry: {
  name: string; description: string; tags: string[]; params: StrategyParams;
}): Strategy

export function getStrategies(): Strategy[]
export function getActiveStrategies(): Strategy[]            // archived=false only

export function updateStrategyMeta(
  id: string,
  updates: Partial<Pick<Strategy, "name" | "description" | "tags" | "favorite" | "archived">>
): void

export function updateStrategyParams(
  id: string, params: StrategyParams, versionNote: string
): void  // saves old params as version entry before updating

export function cloneStrategy(id: string, newName: string): Strategy

export function rollbackStrategy(id: string, versionIndex: number): void
// Takes versions[versionIndex].params, saves current params as a new version entry, then sets current params

export function deleteStrategy(id: string): void
export function clearStrategies(): void
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/strategy-storage.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/strategy-storage.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement lib/strategy-storage.ts**

Create `lib/strategy-storage.ts`:
```typescript
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
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/strategy-storage.test.ts
```

Expected: 11/11 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: All 48 tests pass (37 existing + 11 strategy)

- [ ] **Step 6: Commit**

```bash
git add lib/strategy-storage.ts tests/lib/strategy-storage.test.ts
git commit -m "feat: add strategy localStorage storage with version history"
```

---

### Task 2: lib/notebook-storage.ts + tests

**Files:**
- Create: `lib/notebook-storage.ts`
- Create: `tests/lib/notebook-storage.test.ts`

**Interfaces — Produces (Tasks 5, 6, 7, 8 depend on these exact names):**
```typescript
export type BlockType = "comment" | "metric" | "table" | "chart" | "image";

export interface CommentBlock  { type: "comment";  markdown: string; }
export interface MetricBlock   { type: "metric";   label: string; value: number | null; unit: string; }
export interface TableBlock    { type: "table";    headers: string[]; rows: (string | number | null)[][]; }
export interface ChartBlock    { type: "chart";    title: string; data: Array<{ time: string; value: number }>; }
export interface ImageBlock    { type: "image";    src: string; alt: string; }
export type NotebookBlock = CommentBlock | MetricBlock | TableBlock | ChartBlock | ImageBlock;

export interface NotebookEntry {
  id: string;       // `blk_${Date.now()}_${5-char random}`
  block: NotebookBlock;
}

export interface Notebook {
  id: string;             // `nb_${Date.now()}_${5-char random}`
  title: string;
  tags: string[];
  experimentIds: string[];
  entries: NotebookEntry[];
  createdAt: number;
  updatedAt: number;
}

export function createNotebook(title: string): Notebook
export function getNotebooks(): Notebook[]
export function updateNotebookMeta(id: string, updates: Partial<Pick<Notebook, "title" | "tags" | "experimentIds">>): void
export function addBlock(notebookId: string, block: NotebookBlock): NotebookEntry
export function updateBlock(notebookId: string, entryId: string, block: NotebookBlock): void
export function removeBlock(notebookId: string, entryId: string): void
export function moveBlock(notebookId: string, entryId: string, direction: "up" | "down"): void
export function deleteNotebook(id: string): void
export function clearNotebooks(): void
```

- [ ] **Step 1: Write failing tests**

Create `tests/lib/notebook-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  createNotebook, getNotebooks, updateNotebookMeta,
  addBlock, updateBlock, removeBlock, moveBlock,
  deleteNotebook, clearNotebooks,
  type CommentBlock, type MetricBlock,
} from "../../lib/notebook-storage";

const COMMENT: CommentBlock = { type: "comment", markdown: "Hello" };
const METRIC: MetricBlock   = { type: "metric", label: "Sharpe", value: 1.5, unit: "" };

describe("notebook-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getNotebooks returns [] when empty", () => {
    expect(getNotebooks()).toEqual([]);
  });

  it("getNotebooks returns [] on corrupt JSON", () => {
    localStorage.setItem("nautilus:notebooks", "BAD");
    expect(getNotebooks()).toEqual([]);
  });

  it("createNotebook persists and returns notebook with id/timestamps/empty entries", () => {
    const nb = createNotebook("My Research");
    expect(nb.id).toMatch(/^nb_\d+_[a-z0-9]{5}$/);
    expect(nb.title).toBe("My Research");
    expect(nb.entries).toHaveLength(0);
    expect(nb.tags).toHaveLength(0);
    expect(nb.experimentIds).toHaveLength(0);
    expect(getNotebooks()).toHaveLength(1);
  });

  it("createNotebook prepends (newest first)", () => {
    createNotebook("A");
    createNotebook("B");
    expect(getNotebooks()[0].title).toBe("B");
  });

  it("updateNotebookMeta updates title and tags", () => {
    const nb = createNotebook("Old");
    updateNotebookMeta(nb.id, { title: "New", tags: ["research", "equity"] });
    const updated = getNotebooks().find(x => x.id === nb.id)!;
    expect(updated.title).toBe("New");
    expect(updated.tags).toEqual(["research", "equity"]);
  });

  it("addBlock appends entry with blk_ id", () => {
    const nb = createNotebook("NB");
    const entry = addBlock(nb.id, COMMENT);
    expect(entry.id).toMatch(/^blk_\d+_[a-z0-9]{5}$/);
    expect(entry.block).toEqual(COMMENT);
    expect(getNotebooks().find(x => x.id === nb.id)!.entries).toHaveLength(1);
  });

  it("addBlock appends (not prepends)", () => {
    const nb = createNotebook("NB");
    addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("comment");
    expect(entries[1].block.type).toBe("metric");
  });

  it("updateBlock replaces block content by entry id", () => {
    const nb = createNotebook("NB");
    const entry = addBlock(nb.id, COMMENT);
    const updated: CommentBlock = { type: "comment", markdown: "Updated" };
    updateBlock(nb.id, entry.id, updated);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block).toEqual(updated);
  });

  it("removeBlock removes entry by id", () => {
    const nb = createNotebook("NB");
    const e1 = addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    removeBlock(nb.id, e1.id);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].block.type).toBe("metric");
  });

  it("moveBlock up swaps with previous entry", () => {
    const nb = createNotebook("NB");
    addBlock(nb.id, COMMENT);
    const e2 = addBlock(nb.id, METRIC);
    moveBlock(nb.id, e2.id, "up");
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("metric");
    expect(entries[1].block.type).toBe("comment");
  });

  it("moveBlock up on first entry is a no-op", () => {
    const nb = createNotebook("NB");
    const e1 = addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    moveBlock(nb.id, e1.id, "up");
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("comment");
  });

  it("deleteNotebook removes by id", () => {
    const nb = createNotebook("del");
    deleteNotebook(nb.id);
    expect(getNotebooks()).toHaveLength(0);
  });

  it("clearNotebooks empties storage", () => {
    createNotebook("A");
    clearNotebooks();
    expect(getNotebooks()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test tests/lib/notebook-storage.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement lib/notebook-storage.ts**

Create `lib/notebook-storage.ts`:
```typescript
const STORAGE_KEY = "nautilus:notebooks";
const MAX_NOTEBOOKS = 100;

export type BlockType = "comment" | "metric" | "table" | "chart" | "image";

export interface CommentBlock  { type: "comment";  markdown: string; }
export interface MetricBlock   { type: "metric";   label: string; value: number | null; unit: string; }
export interface TableBlock    { type: "table";    headers: string[]; rows: (string | number | null)[][]; }
export interface ChartBlock    { type: "chart";    title: string; data: Array<{ time: string; value: number }>; }
export interface ImageBlock    { type: "image";    src: string; alt: string; }
export type NotebookBlock = CommentBlock | MetricBlock | TableBlock | ChartBlock | ImageBlock;

export interface NotebookEntry {
  id: string;
  block: NotebookBlock;
}

export interface Notebook {
  id: string;
  title: string;
  tags: string[];
  experimentIds: string[];
  entries: NotebookEntry[];
  createdAt: number;
  updatedAt: number;
}

function genNbId(): string {
  return `nb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function genBlkId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getNotebooks(): Notebook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notebook[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(notebooks: Notebook[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks.slice(0, Math.floor(MAX_NOTEBOOKS / 2))));
    } catch {
      // Storage exhausted — silently skip
    }
  }
}

export function createNotebook(title: string): Notebook {
  const now = Date.now();
  const notebook: Notebook = {
    id: genNbId(),
    title,
    tags: [],
    experimentIds: [],
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
  const existing = getNotebooks();
  persist([notebook, ...existing].slice(0, MAX_NOTEBOOKS));
  return notebook;
}

export function updateNotebookMeta(
  id: string,
  updates: Partial<Pick<Notebook, "title" | "tags" | "experimentIds">>
): void {
  persist(getNotebooks().map(nb =>
    nb.id === id ? { ...nb, ...updates, updatedAt: Date.now() } : nb
  ));
}

export function addBlock(notebookId: string, block: NotebookBlock): NotebookEntry {
  const entry: NotebookEntry = { id: genBlkId(), block };
  persist(getNotebooks().map(nb =>
    nb.id === notebookId
      ? { ...nb, entries: [...nb.entries, entry], updatedAt: Date.now() }
      : nb
  ));
  return entry;
}

export function updateBlock(
  notebookId: string, entryId: string, block: NotebookBlock
): void {
  persist(getNotebooks().map(nb => {
    if (nb.id !== notebookId) return nb;
    return {
      ...nb,
      entries: nb.entries.map(e => e.id === entryId ? { ...e, block } : e),
      updatedAt: Date.now(),
    };
  }));
}

export function removeBlock(notebookId: string, entryId: string): void {
  persist(getNotebooks().map(nb => {
    if (nb.id !== notebookId) return nb;
    return { ...nb, entries: nb.entries.filter(e => e.id !== entryId), updatedAt: Date.now() };
  }));
}

export function moveBlock(
  notebookId: string, entryId: string, direction: "up" | "down"
): void {
  persist(getNotebooks().map(nb => {
    if (nb.id !== notebookId) return nb;
    const entries = [...nb.entries];
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx === -1) return nb;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= entries.length) return nb;
    [entries[idx], entries[swapIdx]] = [entries[swapIdx], entries[idx]];
    return { ...nb, entries, updatedAt: Date.now() };
  }));
}

export function deleteNotebook(id: string): void {
  persist(getNotebooks().filter(nb => nb.id !== id));
}

export function clearNotebooks(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npm test tests/lib/notebook-storage.test.ts
```

Expected: 13/13 passing

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: All 61 tests pass (48 + 13 notebook)

- [ ] **Step 6: Commit**

```bash
git add lib/notebook-storage.ts tests/lib/notebook-storage.test.ts
git commit -m "feat: add notebook localStorage storage with 5 block types"
```

---

### Task 3: Strategy UI components

**Files:**
- Create: `components/strategies/StrategyCard.tsx`
- Create: `components/strategies/StrategyCompare.tsx`
- Create: `components/strategies/SaveStrategyForm.tsx`

**Interfaces:**
- Consumes: `Strategy`, `StrategyParams`, `EmaParams`, `GatedParams`, `cloneStrategy`, `updateStrategyMeta`, `deleteStrategy` from `@/lib/strategy-storage`
- Consumes: `SpawnRuleState` from `@/lib/backtest-types` (for gated params display)

No tests (UI components).

- [ ] **Step 1: Create components/strategies/ directory and StrategyCard.tsx**

```bash
mkdir -p components/strategies
```

Create `components/strategies/StrategyCard.tsx`:
```tsx
"use client";

import type { Strategy } from "@/lib/strategy-storage";

interface StrategyCardProps {
  strategy: Strategy;
  selected: boolean;
  onSelect: (id: string) => void;
  onFavorite: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (strategy: Strategy) => void;
}

function paramsLabel(strategy: Strategy): string {
  const p = strategy.params;
  if (p.type === "ema_cross") return `EMA ${p.fast}/${p.slow}`;
  return `Gated · ${p.rules.length} rule${p.rules.length !== 1 ? "s" : ""}`;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StrategyCard({
  strategy, selected, onSelect, onFavorite, onArchive, onClone, onDelete, onRun,
}: StrategyCardProps) {
  return (
    <div
      className={`bg-panel border rounded-lg p-4 space-y-3 cursor-pointer transition-colors ${
        selected ? "border-accent" : "border-border hover:border-border/80"
      }`}
      onClick={() => onSelect(strategy.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text-1 font-medium truncate">{strategy.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onFavorite(strategy.id, !strategy.favorite); }}
              className={`text-sm bg-transparent border-0 cursor-pointer p-0 transition-colors shrink-0 ${
                strategy.favorite ? "text-warn" : "text-text-3 hover:text-warn"
              }`}
              title={strategy.favorite ? "Remove from favorites" : "Add to favorites"}
            >
              {strategy.favorite ? "★" : "☆"}
            </button>
          </div>
          <div className="text-text-3 text-[10px] font-data mt-0.5">{timeAgo(strategy.updatedAt)}</div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
          strategy.params.type === "ema_cross"
            ? "bg-info/10 text-info"
            : "bg-warn/10 text-warn"
        }`}>
          {strategy.params.type === "ema_cross" ? "EMA Cross" : "Gated"}
        </span>
      </div>

      {/* Params */}
      <div className="text-text-2 text-xs font-data">{paramsLabel(strategy)}</div>

      {/* Description */}
      {strategy.description && (
        <p className="text-text-3 text-xs truncate">{strategy.description}</p>
      )}

      {/* Tags */}
      {strategy.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {strategy.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-panel-2 border border-border rounded text-text-3">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: version count + actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <span className="text-text-3 text-[9px] font-data">
          {strategy.versions.length > 0 ? `${strategy.versions.length} version${strategy.versions.length !== 1 ? "s" : ""}` : "No history"}
        </span>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onRun(strategy)}
            className="text-xs px-2.5 h-6 bg-accent text-black font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
          >
            Run
          </button>
          <button
            onClick={() => onClone(strategy.id)}
            className="text-[10px] px-2 h-6 bg-panel-2 border border-border rounded text-text-2 cursor-pointer hover:text-text-1 transition-colors"
          >
            Clone
          </button>
          <button
            onClick={() => onArchive(strategy.id, !strategy.archived)}
            className="text-[10px] px-2 h-6 bg-panel-2 border border-border rounded text-text-2 cursor-pointer hover:text-text-1 transition-colors"
            title={strategy.archived ? "Unarchive" : "Archive"}
          >
            {strategy.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={() => onDelete(strategy.id)}
            className="text-[10px] h-6 px-1.5 bg-transparent border-0 text-text-3 hover:text-neg cursor-pointer transition-colors"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StrategyCompare.tsx**

Create `components/strategies/StrategyCompare.tsx`:
```tsx
"use client";

import type { Strategy, StrategyParams } from "@/lib/strategy-storage";

interface StrategyCompareProps {
  strategies: [Strategy, Strategy];
  onClose: () => void;
}

function renderParams(params: StrategyParams): React.ReactNode {
  if (params.type === "ema_cross") {
    return (
      <div className="space-y-1 text-xs font-data">
        <div className="flex justify-between"><span className="text-text-3">Type</span><span className="text-text-2">EMA Cross</span></div>
        <div className="flex justify-between"><span className="text-text-3">Fast EMA</span><span className="text-text-2">{params.fast}</span></div>
        <div className="flex justify-between"><span className="text-text-3">Slow EMA</span><span className="text-text-2">{params.slow}</span></div>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-xs font-data">
      <div className="flex justify-between"><span className="text-text-3">Type</span><span className="text-text-2">Gated</span></div>
      <div className="flex justify-between"><span className="text-text-3">Rules</span><span className="text-text-2">{params.rules.length}</span></div>
      {params.rules.map((r, i) => (
        <div key={r.id} className="flex justify-between pl-2">
          <span className="text-text-3">Rule {i + 1} EMA</span>
          <span className="text-text-2">{r.fast}/{r.slow} ({r.combinator})</span>
        </div>
      ))}
    </div>
  );
}

function diffClass(a: number, b: number, higherBetter = true): string {
  if (a === b) return "text-text-3";
  return (higherBetter ? b > a : b < a) ? "text-pos" : "text-neg";
}

export function StrategyCompare({ strategies, onClose }: StrategyCompareProps) {
  const [a, b] = strategies;
  const bothEma = a.params.type === "ema_cross" && b.params.type === "ema_cross";

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Strategy Comparison</span>
        <button
          onClick={onClose}
          className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer transition-colors"
        >
          Close ×
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border p-4 gap-4">
        {[a, b].map((s, i) => (
          <div key={s.id} className="space-y-3">
            <div>
              <div className="text-text-1 font-medium text-sm">{s.name}</div>
              <div className="text-text-3 text-[10px] mt-0.5">{s.description || "No description"}</div>
            </div>
            {renderParams(s.params)}
            <div className="text-text-3 text-[9px]">
              {s.versions.length} version{s.versions.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Numeric diff for EMA cross */}
      {bothEma && (() => {
        const ap = a.params as import("@/lib/strategy-storage").EmaParams;
        const bp = b.params as import("@/lib/strategy-storage").EmaParams;
        return (
          <div className="px-4 pb-4 border-t border-border/40 pt-3">
            <span className="text-text-3 text-[10px] uppercase tracking-wider">Delta (B − A)</span>
            <div className="flex gap-6 mt-2 text-xs font-data">
              <span>Fast: <span className={diffClass(ap.fast, bp.fast, false)}>{bp.fast - ap.fast >= 0 ? "+" : ""}{bp.fast - ap.fast}</span></span>
              <span>Slow: <span className={diffClass(ap.slow, bp.slow, false)}>{bp.slow - ap.slow >= 0 ? "+" : ""}{bp.slow - ap.slow}</span></span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 3: Create SaveStrategyForm.tsx**

Create `components/strategies/SaveStrategyForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { StrategyParams } from "@/lib/strategy-storage";
import { createStrategy } from "@/lib/strategy-storage";

interface SaveStrategyFormProps {
  params: StrategyParams;
  onSaved: () => void;
  onCancel: () => void;
}

export function SaveStrategyForm({ params, onSaved, onCancel }: SaveStrategyFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createStrategy({
      name: trimmed,
      description: description.trim(),
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      params,
    });
    onSaved();
  }

  return (
    <div className="bg-panel-2 border border-border rounded-lg p-4 space-y-3">
      <div className="text-text-3 text-[11px] uppercase tracking-wider">Save as Strategy</div>

      <div className="space-y-2">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="Strategy name (required)"
          className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
        />
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
        />
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 h-8 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 h-8 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run full tests to confirm no regressions**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/strategies/StrategyCard.tsx components/strategies/StrategyCompare.tsx components/strategies/SaveStrategyForm.tsx
git commit -m "feat: add strategy UI components (card, compare, save form)"
```

---

### Task 4: app/strategies/page.tsx + Save Strategy in backtest

**Files:**
- Create: `app/strategies/page.tsx`
- Modify: `app/backtest/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `StrategyCard`, `StrategyCompare`, `SaveStrategyForm` (from Task 3)
- Consumes: `Strategy`, `getStrategies`, `getActiveStrategies`, `cloneStrategy`, `updateStrategyMeta`, `rollbackStrategy`, `deleteStrategy` from `@/lib/strategy-storage`
- Consumes existing: `StrategyParams` (constructed in backtest page from `fast`, `slow`, `rules`, `mode`)

No tests (UI page).

- [ ] **Step 1: Read app/backtest/page.tsx to understand current structure before editing**

Read the file before any edits.

- [ ] **Step 2: Update app/backtest/page.tsx**

Add these changes to the backtest page:

**Imports to add** (after existing imports):
```typescript
import { SaveStrategyForm } from "@/components/strategies/SaveStrategyForm";
import type { StrategyParams } from "@/lib/strategy-storage";
```

**State to add** (inside BacktestPage component):
```typescript
const [showSaveStrategy, setShowSaveStrategy] = useState(false);
```

**Helper to add** (inside BacktestPage, before the return):
```typescript
function currentStrategyParams(): StrategyParams {
  if (mode === "single") {
    return { type: "ema_cross", fast, slow };
  }
  return { type: "gated", rules };
}
```

**JSX changes — in the title area**, after the existing nav links (`Experiments →` and `Heatmap →`), add:
```tsx
<button
  onClick={() => setShowSaveStrategy(v => !v)}
  className="text-text-3 hover:text-accent text-xs bg-transparent border-0 cursor-pointer transition-colors"
>
  Save Strategy
</button>
```

**JSX changes — after the error div** (before the bottom analytics grid), add:
```tsx
{showSaveStrategy && (
  <SaveStrategyForm
    params={currentStrategyParams()}
    onSaved={() => setShowSaveStrategy(false)}
    onCancel={() => setShowSaveStrategy(false)}
  />
)}
```

- [ ] **Step 3: Create app/strategies/page.tsx**

Create `app/strategies/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { StrategyCompare } from "@/components/strategies/StrategyCompare";
import {
  getStrategies, updateStrategyMeta, cloneStrategy,
  rollbackStrategy, deleteStrategy,
  type Strategy,
} from "@/lib/strategy-storage";

type Filter = "all" | "favorites" | "archived";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [showVersions, setShowVersions] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setStrategies(getStrategies());
  }, []);

  function refresh() {
    setStrategies(getStrategies());
  }

  function handleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleFavorite(id: string, v: boolean) {
    updateStrategyMeta(id, { favorite: v });
    refresh();
  }

  function handleArchive(id: string, v: boolean) {
    updateStrategyMeta(id, { archived: v });
    refresh();
  }

  function handleClone(id: string) {
    const original = strategies.find(s => s.id === id);
    if (!original) return;
    cloneStrategy(id, `Clone of ${original.name}`);
    refresh();
  }

  function handleDelete(id: string) {
    deleteStrategy(id);
    setSelected(prev => prev.filter(s => s !== id));
    refresh();
  }

  function handleRun(strategy: Strategy) {
    // Encode strategy params into sessionStorage for backtest page to read
    // Simple approach: navigate to backtest (user re-enters params manually for MVP)
    // We store a hint in sessionStorage
    try {
      sessionStorage.setItem("nautilus:pending_strategy", JSON.stringify(strategy.params));
    } catch {
      // ignore
    }
    router.push("/backtest");
  }

  function handleRollback(strategyId: string, versionIdx: number) {
    rollbackStrategy(strategyId, versionIdx);
    refresh();
  }

  const visible = strategies.filter(s => {
    if (filter === "favorites" && !s.favorite) return false;
    if (filter === "archived" && !s.archived) return false;
    if (filter === "all" && s.archived) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const compareStrategies: [Strategy, Strategy] | null = (() => {
    if (selected.length !== 2) return null;
    const a = strategies.find(s => s.id === selected[0]);
    const b = strategies.find(s => s.id === selected[1]);
    return a && b ? [a, b] : null;
  })();

  const versionStrategy = showVersions ? strategies.find(s => s.id === showVersions) : null;

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Repository</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Saved strategies. Select two to compare. Click history to rollback.
          </p>
        </div>
        <Link href="/backtest" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
          ← Backtest
        </Link>
      </div>

      {/* Compare panel */}
      {compareStrategies && (
        <StrategyCompare
          strategies={compareStrategies}
          onClose={() => setSelected([])}
        />
      )}

      {/* Version history panel */}
      {versionStrategy && versionStrategy.versions.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              Version History — {versionStrategy.name}
            </span>
            <button
              onClick={() => setShowVersions(null)}
              className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer"
            >
              Close ×
            </button>
          </div>
          <div className="p-4 space-y-2">
            {versionStrategy.versions.map((v, i) => (
              <div key={i} className="flex items-center gap-4 text-xs">
                <span className="text-text-3 font-data w-20 shrink-0">
                  {new Date(v.savedAt).toLocaleDateString()}
                </span>
                <span className="text-text-2 flex-1 font-data">
                  {v.params.type === "ema_cross"
                    ? `EMA ${v.params.fast}/${v.params.slow}`
                    : `Gated ${v.params.rules.length} rules`}
                </span>
                <span className="text-text-3 flex-1 italic">{v.note}</span>
                <button
                  onClick={() => { handleRollback(versionStrategy.id, i); setShowVersions(null); }}
                  className="text-info text-[10px] bg-transparent border-0 cursor-pointer hover:underline"
                >
                  Rollback
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="h-8 w-64 px-3 text-xs bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
        />
        <div className="flex gap-1">
          {(["all", "favorites", "archived"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-8 text-xs rounded border transition-colors cursor-pointer capitalize ${
                filter === f
                  ? "border-b-2 border-accent text-accent bg-panel-2"
                  : "border-border text-text-3 hover:text-text-1 bg-panel-2"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-text-3 text-xs font-data ml-auto">{visible.length} / {strategies.filter(s => filter === "archived" ? s.archived : !s.archived).length}</span>
      </div>

      {/* Strategy grid */}
      {strategies.length === 0 ? (
        <div className="text-center py-12 text-text-3 text-sm">
          No strategies saved yet. Run a backtest and click "Save Strategy" to get started.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8 text-text-3 text-sm">No strategies match this filter.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(s => (
            <div key={s.id} className="relative">
              <StrategyCard
                strategy={s}
                selected={selected.includes(s.id)}
                onSelect={handleSelect}
                onFavorite={handleFavorite}
                onArchive={handleArchive}
                onClone={handleClone}
                onDelete={handleDelete}
                onRun={handleRun}
              />
              {s.versions.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setShowVersions(prev => prev === s.id ? null : s.id); }}
                  className="absolute top-3 right-3 text-[9px] text-text-3 hover:text-info bg-transparent border-0 cursor-pointer transition-colors"
                >
                  {s.versions.length}v
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update app/layout.tsx — add Strategies nav item**

Read `app/layout.tsx` first. Then add `{ href: "/strategies", label: "Strategies" }` between Experiments and Research (quant):

```typescript
const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/market",      label: "Market" },
  { href: "/backtest",    label: "Backtest" },
  { href: "/experiments", label: "Experiments" },
  { href: "/strategies",  label: "Strategies" },   // NEW
  { href: "/quant",       label: "Research" },
  { href: "/bots",        label: "Bots" },
  { href: "/ai-trader",   label: "AI Trader" },
];
```

- [ ] **Step 5: Run full tests**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 6: Commit**

```bash
git add app/strategies/page.tsx app/backtest/page.tsx app/layout.tsx
git commit -m "feat: add Strategies page with version history, compare, rollback"
```

---

### Task 5: components/notebooks/NoteBlockRenderer.tsx

**Files:**
- Create: `components/notebooks/NoteBlockRenderer.tsx`

**Interfaces:**
- Consumes: `NotebookEntry`, `NotebookBlock`, `CommentBlock`, `MetricBlock`, `TableBlock`, `ChartBlock`, `ImageBlock` from `@/lib/notebook-storage`
- Props: `{ entry: NotebookEntry; onEdit?: () => void; onDelete?: () => void; onMoveUp?: () => void; onMoveDown?: () => void; }`

No tests (UI component, requires browser/chart APIs).

**Design notes:**
- `comment`: `<pre>` tag with `whitespace-pre-wrap text-text-2 text-sm`
- `metric`: large value display with label and unit
- `table`: `<table>` with thead/tbody, styled with design tokens
- `chart`: lightweight-charts LineSeries from stored data — uses `useRef`+`useEffect`, `createChart`, `chart.addSeries(LineSeries, ...)`, cleanup on unmount. Data: `entry.data.map(d => ({ time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp, value: d.value }))`
- `image`: `<img>` with `max-w-full h-auto rounded`
- Controls (Edit/Delete/↑/↓): only shown if callbacks provided

- [ ] **Step 1: Create components/notebooks/ directory and NoteBlockRenderer.tsx**

```bash
mkdir -p components/notebooks
```

Create `components/notebooks/NoteBlockRenderer.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { NotebookEntry, ChartBlock } from "@/lib/notebook-storage";

interface NoteBlockRendererProps {
  entry: NotebookEntry;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function ChartBlockView({ block }: { block: ChartBlock }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || block.data.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 180,
      layout: {
        background: { color: "#0F131A" },
        textColor: "#6B7280",
      },
      grid: {
        vertLines: { color: "#1F2937" },
        horzLines: { color: "#1F2937" },
      },
      timeScale: { borderColor: "#1F2937" },
    });

    const series = chart.addSeries(LineSeries, { color: "#FF9F1C", lineWidth: 2 });
    series.setData(
      block.data.map(d => ({
        time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
        value: d.value,
      }))
    );
    chart.timeScale().fitContent();

    return () => { chart.remove(); };
  }, [block.data]);

  return (
    <div>
      {block.title && <div className="text-text-3 text-xs mb-2">{block.title}</div>}
      {block.data.length === 0 ? (
        <div className="h-[180px] bg-panel-2 rounded flex items-center justify-center text-text-3 text-xs">
          No data
        </div>
      ) : (
        <div ref={containerRef} className="w-full rounded overflow-hidden" />
      )}
    </div>
  );
}

export function NoteBlockRenderer({
  entry, onEdit, onDelete, onMoveUp, onMoveDown,
}: NoteBlockRendererProps) {
  const { block } = entry;
  const hasControls = onEdit || onDelete || onMoveUp || onMoveDown;

  function renderBlock() {
    switch (block.type) {
      case "comment":
        return (
          <pre className="text-text-2 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {block.markdown}
          </pre>
        );

      case "metric":
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-text-1 text-3xl font-data font-semibold">
              {block.value !== null ? block.value.toFixed(2) : "—"}
            </span>
            {block.unit && (
              <span className="text-text-3 text-sm">{block.unit}</span>
            )}
            <span className="text-text-3 text-sm ml-auto">{block.label}</span>
          </div>
        );

      case "table":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {block.headers.length > 0 && (
                <thead>
                  <tr className="border-b border-border">
                    {block.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-text-3 font-normal uppercase tracking-wider text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/40">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-text-2 font-data">
                        {cell !== null ? String(cell) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "chart":
        return <ChartBlockView block={block} />;

      case "image":
        return (
          <img
            src={block.src}
            alt={block.alt || "notebook image"}
            className="max-w-full h-auto rounded border border-border"
          />
        );
    }
  }

  return (
    <div className="group bg-panel border border-border rounded-lg p-4 relative">
      {hasControls && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <button onClick={onMoveUp} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              ↑
            </button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              ↓
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-[10px] px-1.5 h-5 bg-transparent border-0 text-text-3 hover:text-neg cursor-pointer transition-colors">
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-text-3 uppercase tracking-wider">
          {block.type}
        </span>
      </div>

      {renderBlock()}
    </div>
  );
}
```

- [ ] **Step 2: Run full tests to confirm no regressions**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/notebooks/NoteBlockRenderer.tsx
git commit -m "feat: add NoteBlockRenderer for all 5 notebook block types"
```

---

### Task 6: components/notebooks/NoteBlockEditor.tsx

**Files:**
- Create: `components/notebooks/NoteBlockEditor.tsx`

**Interfaces:**
- Consumes: `NotebookBlock`, all block subtypes from `@/lib/notebook-storage`
- Props: `{ initial?: NotebookBlock; onSave: (block: NotebookBlock) => void; onCancel: () => void; }`

No tests (UI form).

**Design:** Dropdown to select block type. Conditional fields per type. JSON textarea for chart data with parse validation.

- [ ] **Step 1: Create NoteBlockEditor.tsx**

Create `components/notebooks/NoteBlockEditor.tsx`:
```tsx
"use client";

import { useState } from "react";
import type {
  NotebookBlock, BlockType,
  CommentBlock, MetricBlock, TableBlock, ChartBlock, ImageBlock,
} from "@/lib/notebook-storage";

interface NoteBlockEditorProps {
  initial?: NotebookBlock;
  onSave: (block: NotebookBlock) => void;
  onCancel: () => void;
}

const DEFAULT_BLOCKS: Record<BlockType, NotebookBlock> = {
  comment: { type: "comment", markdown: "" },
  metric:  { type: "metric",  label: "", value: null, unit: "" },
  table:   { type: "table",   headers: ["Column 1", "Column 2"], rows: [["", ""]] },
  chart:   { type: "chart",   title: "", data: [] },
  image:   { type: "image",   src: "", alt: "" },
};

function labelForType(t: BlockType): string {
  return { comment: "Comment", metric: "Metric", table: "Table", chart: "Chart", image: "Image" }[t];
}

export function NoteBlockEditor({ initial, onSave, onCancel }: NoteBlockEditorProps) {
  const [blockType, setBlockType] = useState<BlockType>(initial?.type ?? "comment");
  const [draft, setDraft] = useState<NotebookBlock>(initial ?? DEFAULT_BLOCKS.comment);
  const [chartJson, setChartJson] = useState(
    initial?.type === "chart" ? JSON.stringify(initial.data, null, 2) : ""
  );
  const [chartJsonError, setChartJsonError] = useState("");

  function handleTypeChange(t: BlockType) {
    setBlockType(t);
    setDraft(DEFAULT_BLOCKS[t]);
    setChartJson("");
    setChartJsonError("");
  }

  function updateDraft(updates: Partial<NotebookBlock>) {
    setDraft(prev => ({ ...prev, ...updates } as NotebookBlock));
  }

  function handleSave() {
    if (blockType === "chart") {
      try {
        const parsed = JSON.parse(chartJson || "[]") as Array<{ time: string; value: number }>;
        if (!Array.isArray(parsed)) throw new Error("Must be an array");
        for (const item of parsed) {
          if (!item.time || typeof item.value !== "number") throw new Error("Each item needs {time, value}");
        }
        onSave({ ...(draft as ChartBlock), data: parsed });
      } catch (e) {
        setChartJsonError(e instanceof Error ? e.message : "Invalid JSON");
      }
      return;
    }
    onSave(draft);
  }

  function renderFields() {
    switch (blockType) {
      case "comment":
        return (
          <textarea
            rows={6}
            value={(draft as CommentBlock).markdown}
            onChange={e => updateDraft({ markdown: e.target.value })}
            placeholder="Write your notes here…"
            className="w-full px-3 py-2 text-sm bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-sans"
          />
        );

      case "metric":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as MetricBlock).label}
              onChange={e => updateDraft({ label: e.target.value })}
              placeholder="Label (e.g. Sharpe Ratio)"
              className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <input type="number" value={(draft as MetricBlock).value ?? ""}
                onChange={e => updateDraft({ value: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="Value"
                className="flex-1 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"
              />
              <input type="text" value={(draft as MetricBlock).unit}
                onChange={e => updateDraft({ unit: e.target.value })}
                placeholder="Unit (optional)"
                className="w-24 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
              />
            </div>
          </div>
        );

      case "table":
        return (
          <div className="space-y-2">
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Headers (comma-separated)</label>
              <input type="text"
                value={(draft as TableBlock).headers.join(",")}
                onChange={e => updateDraft({ headers: e.target.value.split(",").map(h => h.trim()) })}
                placeholder="Col A, Col B, Col C"
                className="w-full mt-1 h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Rows (JSON array of arrays)</label>
              <textarea rows={4}
                value={JSON.stringify((draft as TableBlock).rows, null, 2)}
                onChange={e => {
                  try {
                    const rows = JSON.parse(e.target.value);
                    if (Array.isArray(rows)) updateDraft({ rows });
                  } catch { /* ignore invalid JSON while typing */ }
                }}
                className="w-full mt-1 px-3 py-2 text-xs bg-panel border border-border rounded text-text-1 outline-none focus:border-accent resize-y font-data"
              />
            </div>
          </div>
        );

      case "chart":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as ChartBlock).title}
              onChange={e => updateDraft({ title: e.target.value })}
              placeholder="Chart title (optional)"
              className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
            />
            <div>
              <label className="text-text-3 text-[10px] uppercase tracking-wider">Data (JSON array of {"{ time, value }"})</label>
              <textarea rows={6}
                value={chartJson}
                onChange={e => { setChartJson(e.target.value); setChartJsonError(""); }}
                placeholder={'[{"time": "2025-01-01", "value": 1.5}, ...]'}
                className="w-full mt-1 px-3 py-2 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-y font-data"
              />
              {chartJsonError && <p className="text-neg text-[10px] mt-1">{chartJsonError}</p>}
            </div>
          </div>
        );

      case "image":
        return (
          <div className="space-y-2">
            <input type="text" value={(draft as ImageBlock).src}
              onChange={e => updateDraft({ src: e.target.value })}
              placeholder="Image URL or paste base64 data"
              className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
            />
            <input type="text" value={(draft as ImageBlock).alt}
              onChange={e => updateDraft({ alt: e.target.value })}
              placeholder="Alt text (optional)"
              className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
            />
          </div>
        );
    }
  }

  return (
    <div className="bg-panel-2 border border-border rounded-lg p-4 space-y-4">
      {/* Type selector */}
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[10px] uppercase tracking-wider shrink-0">Block type</span>
        <div className="flex gap-1">
          {(["comment", "metric", "table", "chart", "image"] as BlockType[]).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 h-7 text-xs rounded border cursor-pointer capitalize transition-colors ${
                blockType === t
                  ? "border-accent text-text-1 bg-panel"
                  : "border-border text-text-3 hover:text-text-1 bg-panel"
              }`}
            >
              {labelForType(t)}
            </button>
          ))}
        </div>
      </div>

      {/* Type-specific fields */}
      {renderFields()}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 h-8 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
        >
          {initial ? "Update" : "Add Block"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 h-8 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full tests**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/notebooks/NoteBlockEditor.tsx
git commit -m "feat: add NoteBlockEditor for creating/editing all 5 block types"
```

---

### Task 7: components/notebooks/NotebookEditor.tsx

**Files:**
- Create: `components/notebooks/NotebookEditor.tsx`

**Interfaces:**
- Consumes: `NoteBlockRenderer` from Task 5, `NoteBlockEditor` from Task 6
- Consumes: `Notebook`, `NotebookEntry`, `NotebookBlock`, `addBlock`, `updateBlock`, `removeBlock`, `moveBlock`, `updateNotebookMeta` from `@/lib/notebook-storage`
- Consumes: `Experiment` from `@/lib/experiment-storage` (for experiment link display)
- Props: `{ notebook: Notebook; onUpdate: () => void; }`

No tests (UI component).

- [ ] **Step 1: Create NotebookEditor.tsx**

Create `components/notebooks/NotebookEditor.tsx`:
```tsx
"use client";

import { useState } from "react";
import { NoteBlockRenderer } from "@/components/notebooks/NoteBlockRenderer";
import { NoteBlockEditor } from "@/components/notebooks/NoteBlockEditor";
import {
  addBlock, updateBlock, removeBlock, moveBlock, updateNotebookMeta,
  type Notebook, type NotebookBlock,
} from "@/lib/notebook-storage";

interface NotebookEditorProps {
  notebook: Notebook;
  onUpdate: () => void;
}

export function NotebookEditor({ notebook, onUpdate }: NotebookEditorProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(notebook.tags.join(", "));
  const [editingTags, setEditingTags] = useState(false);
  const [experimentIdDraft, setExperimentIdDraft] = useState("");

  function saveTitle() {
    const t = titleDraft.trim();
    if (t) updateNotebookMeta(notebook.id, { title: t });
    setEditingTitle(false);
    onUpdate();
  }

  function saveTags() {
    const tags = tagsDraft.split(",").map(t => t.trim()).filter(Boolean);
    updateNotebookMeta(notebook.id, { tags });
    setEditingTags(false);
    onUpdate();
  }

  function addExperimentLink() {
    const id = experimentIdDraft.trim();
    if (!id || notebook.experimentIds.includes(id)) return;
    updateNotebookMeta(notebook.id, { experimentIds: [...notebook.experimentIds, id] });
    setExperimentIdDraft("");
    onUpdate();
  }

  function removeExperimentLink(id: string) {
    updateNotebookMeta(notebook.id, { experimentIds: notebook.experimentIds.filter(e => e !== id) });
    onUpdate();
  }

  function handleAddBlock(block: NotebookBlock) {
    addBlock(notebook.id, block);
    setAddingBlock(false);
    onUpdate();
  }

  function handleUpdateBlock(entryId: string, block: NotebookBlock) {
    updateBlock(notebook.id, entryId, block);
    setEditingEntryId(null);
    onUpdate();
  }

  function handleRemoveBlock(entryId: string) {
    removeBlock(notebook.id, entryId);
    onUpdate();
  }

  function handleMoveBlock(entryId: string, direction: "up" | "down") {
    moveBlock(notebook.id, entryId, direction);
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(notebook.title); setEditingTitle(false); } }}
            className="text-text-1 text-lg font-semibold bg-transparent border-b border-accent outline-none w-full"
          />
        ) : (
          <h2
            className="text-text-1 text-lg font-semibold cursor-text hover:text-text-1/80 transition-colors"
            onClick={() => setEditingTitle(true)}
          >
            {notebook.title}
          </h2>
        )}
        <div className="text-text-3 text-[10px] mt-0.5">
          {notebook.entries.length} block{notebook.entries.length !== 1 ? "s" : ""} · {new Date(notebook.updatedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {editingTags ? (
          <input
            autoFocus
            value={tagsDraft}
            onChange={e => setTagsDraft(e.target.value)}
            onBlur={saveTags}
            onKeyDown={e => { if (e.key === "Enter") saveTags(); if (e.key === "Escape") { setTagsDraft(notebook.tags.join(", ")); setEditingTags(false); } }}
            placeholder="tag1, tag2, tag3"
            className="h-6 px-2 text-xs bg-panel border border-accent rounded text-text-1 outline-none"
          />
        ) : (
          <>
            {notebook.tags.map(tag => (
              <span key={tag} className="text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-text-3">
                {tag}
              </span>
            ))}
            <button
              onClick={() => setEditingTags(true)}
              className="text-[9px] text-text-3 hover:text-text-2 bg-transparent border-0 cursor-pointer transition-colors"
            >
              {notebook.tags.length > 0 ? "edit tags" : "+ tags"}
            </button>
          </>
        )}
      </div>

      {/* Experiment links */}
      {(notebook.experimentIds.length > 0 || true) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-3 text-[10px] uppercase tracking-wider shrink-0">Experiments</span>
          {notebook.experimentIds.map(id => (
            <span key={id} className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-info">
              {id.slice(0, 12)}…
              <button
                onClick={() => removeExperimentLink(id)}
                className="text-text-3 hover:text-neg bg-transparent border-0 cursor-pointer p-0 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
          <div className="flex gap-1">
            <input
              type="text"
              value={experimentIdDraft}
              onChange={e => setExperimentIdDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addExperimentLink(); }}
              placeholder="exp_… id"
              className="h-6 w-40 px-2 text-[10px] bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"
            />
            <button
              onClick={addExperimentLink}
              className="h-6 px-2 text-[10px] bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors"
            >
              Link
            </button>
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-3">
        {notebook.entries.map((entry, idx) => (
          <div key={entry.id}>
            {editingEntryId === entry.id ? (
              <NoteBlockEditor
                initial={entry.block}
                onSave={block => handleUpdateBlock(entry.id, block)}
                onCancel={() => setEditingEntryId(null)}
              />
            ) : (
              <NoteBlockRenderer
                entry={entry}
                onEdit={() => setEditingEntryId(entry.id)}
                onDelete={() => handleRemoveBlock(entry.id)}
                onMoveUp={idx > 0 ? () => handleMoveBlock(entry.id, "up") : undefined}
                onMoveDown={idx < notebook.entries.length - 1 ? () => handleMoveBlock(entry.id, "down") : undefined}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add block */}
      {addingBlock ? (
        <NoteBlockEditor
          onSave={handleAddBlock}
          onCancel={() => setAddingBlock(false)}
        />
      ) : (
        <button
          onClick={() => setAddingBlock(true)}
          className="w-full h-10 border border-dashed border-border rounded-lg text-text-3 text-sm hover:text-text-2 hover:border-border/60 transition-colors cursor-pointer bg-transparent"
        >
          + Add block
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full tests**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/notebooks/NotebookEditor.tsx
git commit -m "feat: add NotebookEditor with inline title/tags/experiment editing"
```

---

### Task 8: app/notebooks/page.tsx + nav + progress.md

**Files:**
- Create: `app/notebooks/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: `NotebookEditor` from Task 7
- Consumes: `Notebook`, `createNotebook`, `getNotebooks`, `deleteNotebook` from `@/lib/notebook-storage`

No tests (UI page).

- [ ] **Step 1: Create app/notebooks/page.tsx**

Create `app/notebooks/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { NotebookEditor } from "@/components/notebooks/NotebookEditor";
import {
  createNotebook, getNotebooks, deleteNotebook,
  type Notebook,
} from "@/lib/notebook-storage";

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const all = getNotebooks();
    setNotebooks(all);
    if (all.length > 0 && !activeId) setActiveId(all[0].id);
  }, []);

  function refresh() {
    const all = getNotebooks();
    setNotebooks(all);
  }

  function handleCreate() {
    const nb = createNotebook("Untitled Notebook");
    setNotebooks(prev => [nb, ...prev]);
    setActiveId(nb.id);
  }

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    deleteNotebook(id);
    const remaining = getNotebooks();
    setNotebooks(remaining);
    setActiveId(remaining.length > 0 ? remaining[0].id : null);
    setConfirmDelete(null);
  }

  const activeNotebook = notebooks.find(nb => nb.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Left sidebar: notebook list */}
      <div className="w-64 shrink-0 border-r border-border bg-panel flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Notebooks</span>
          <button
            onClick={handleCreate}
            className="h-6 px-2.5 bg-accent text-black text-[10px] font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {notebooks.length === 0 ? (
            <div className="text-center py-8 text-text-3 text-xs">No notebooks yet</div>
          ) : (
            notebooks.map(nb => (
              <div
                key={nb.id}
                className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                  activeId === nb.id
                    ? "bg-panel-2 border-l-2 border-l-accent"
                    : "hover:bg-panel-2/50 border-l-2 border-l-transparent"
                }`}
                onClick={() => { setActiveId(nb.id); setConfirmDelete(null); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-text-2 text-xs font-medium truncate">{nb.title}</div>
                  <div className="text-text-3 text-[9px] font-data">
                    {nb.entries.length} block{nb.entries.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(nb.id); }}
                  className={`text-[10px] bg-transparent border-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                    confirmDelete === nb.id ? "text-neg" : "text-text-3 hover:text-neg"
                  }`}
                  title={confirmDelete === nb.id ? "Click again to confirm delete" : "Delete notebook"}
                >
                  {confirmDelete === nb.id ? "Confirm" : "×"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: notebook editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeNotebook ? (
          <NotebookEditor
            key={activeNotebook.id}
            notebook={activeNotebook}
            onUpdate={refresh}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-3 text-sm">
            Create or select a notebook to start.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update app/layout.tsx — add Notebooks nav item**

Read `app/layout.tsx` first. Then add `{ href: "/notebooks", label: "Notebooks" }` between Strategies and Research:

```typescript
const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/market",      label: "Market" },
  { href: "/backtest",    label: "Backtest" },
  { href: "/experiments", label: "Experiments" },
  { href: "/strategies",  label: "Strategies" },
  { href: "/notebooks",   label: "Notebooks" },  // NEW
  { href: "/quant",       label: "Research" },
  { href: "/bots",        label: "Bots" },
  { href: "/ai-trader",   label: "AI Trader" },
];
```

- [ ] **Step 3: Run full tests**

```bash
npm test
```

Expected: All 61 tests pass

- [ ] **Step 4: Update docs/progress.md**

Prepend Phase 4 completion entry to `docs/progress.md`:

```
### Research Workspace (2026-06-28)

**S-2 Strategy Repository:**
- `lib/strategy-storage.ts` — Strategy CRUD, version history, clone, rollback (11 tests)
- `components/strategies/StrategyCard.tsx` — card with favorite, archive, clone, run, delete
- `components/strategies/StrategyCompare.tsx` — side-by-side param diff + EMA numeric delta
- `components/strategies/SaveStrategyForm.tsx` — inline save form (name, description, tags)
- `app/backtest/page.tsx` — "Save Strategy" button + SaveStrategyForm panel
- `app/strategies/page.tsx` — browser with search, filter (all/favorites/archived), version history panel, rollback

**S-6 Research Notebook:**
- `lib/notebook-storage.ts` — Notebook CRUD + block CRUD (add/update/remove/move) (13 tests)
- `components/notebooks/NoteBlockRenderer.tsx` — 5 block types: comment/metric/table/chart/image
- `components/notebooks/NoteBlockEditor.tsx` — create/edit any block type with validation
- `components/notebooks/NotebookEditor.tsx` — full editor with inline title/tags/experiment linking
- `app/notebooks/page.tsx` — left sidebar list + right editor panel

**Nav additions:** Strategies, Notebooks (between Experiments and Research)
**Tests:** 61 passing (37 existing + 11 strategy + 13 notebook)
```

- [ ] **Step 5: Commit**

```bash
git add app/notebooks/page.tsx app/layout.tsx docs/progress.md
git commit -m "feat: assemble Notebooks page with sidebar + inline editor, add nav item"
```

---

## Self-Review

### Spec Coverage

**S-2 Strategy Repository:**
| Requirement | Task |
|---|---|
| Save | Task 3 (SaveStrategyForm) + Task 4 (backtest integration) ✅ |
| Clone | Task 3 (StrategyCard) + Task 4 (handleClone) ✅ |
| Fork | ⚠ Same as Clone — createStrategy + cloneStrategy are functionally equivalent to save/fork |
| Archive | Task 3 (StrategyCard archive button) + Task 4 (handleArchive) ✅ |
| Compare (A vs B param diff) | Task 3 (StrategyCompare) + Task 4 (select 2 → compare) ✅ |
| Tag / Favorite | Task 1 (storage fields) + Task 3 (card UI) + Task 4 (filter) ✅ |
| Version History | Task 1 (versions array) + Task 4 (history panel) ✅ |
| Rollback | Task 1 (rollbackStrategy) + Task 4 (rollback button) ✅ |
| localStorage key `nautilus:strategies` | Task 1 ✅ |

**S-6 Research Notebook:**
| Requirement | Task |
|---|---|
| Chart block | Tasks 5, 6 ✅ (lightweight-charts LineSeries) |
| Table block | Tasks 5, 6 ✅ |
| Metric block | Tasks 5, 6 ✅ |
| Comment block | Tasks 5, 6 ✅ |
| Image block | Tasks 5, 6 ✅ |
| Experiment ID link | Task 7 (NotebookEditor experiment link panel) ✅ |
| localStorage key `nautilus:notebooks` | Task 2 ✅ |

### Placeholder Scan

None found. All steps contain complete code.

### Type Consistency

- `StrategyParams` (Task 1) → used in Tasks 3, 4 with exact same union type ✅
- `Strategy.versions: StrategyVersion[]` (Task 1) → rendered in Task 4 history panel ✅
- `NotebookEntry.id` pattern `blk_...` (Task 2) → referenced in Tasks 5, 6, 7 ✅
- `moveBlock(notebookId, entryId, "up" | "down")` (Task 2) → called in Task 7 ✅
- `addBlock(notebookId, block): NotebookEntry` (Task 2) → return value used in Task 7 (called but return not needed since `onUpdate` triggers re-read) ✅
- `NoteBlockRenderer` props `{ entry, onEdit?, onDelete?, onMoveUp?, onMoveDown? }` (Task 5) → all passed in Task 7 ✅
- `NoteBlockEditor` props `{ initial?, onSave, onCancel }` (Task 6) → used correctly in Task 7 ✅
- `NotebookEditor` props `{ notebook, onUpdate }` (Task 7) → passed in Task 8 ✅
