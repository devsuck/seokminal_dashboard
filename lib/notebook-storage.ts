const STORAGE_KEY = "seokminal:notebooks";
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
