const STORAGE_KEY = "nautilus:research_activity";
const MAX_ENTRIES = 50;

export type ActivityType = "backtest" | "strategy" | "experiment" | "portfolio" | "bot";

export interface ResearchActivity {
  id: string;
  type: ActivityType;
  label: string;
  timestamp: number;
  href: string;
}

export function logActivity(entry: Omit<ResearchActivity, "id" | "timestamp">): void {
  const next: ResearchActivity = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const updated = [next, ...readRaw()].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getRecentActivity(limit = MAX_ENTRIES): ResearchActivity[] {
  return readRaw().slice(0, limit);
}

export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function readRaw(): ResearchActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResearchActivity[]) : [];
  } catch {
    return [];
  }
}
