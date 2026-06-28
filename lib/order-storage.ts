export interface OrderLogEntry {
  id: string;
  code: string;
  side: "BUY" | "SELL";
  qty: number;
  order_type: "MARKET" | "LIMIT";
  price?: number;
  order_id: string;
  status: string;
  submitted_at: string;
}

export const STORAGE_KEY = "nautilus_order_log";

export function getOrderLog(): OrderLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as OrderLogEntry[];
  } catch {
    return [];
  }
}

export function addOrderEntry(
  entry: Omit<OrderLogEntry, "id" | "submitted_at">,
): OrderLogEntry[] {
  const log = getOrderLog();
  const full: OrderLogEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    submitted_at: new Date().toISOString(),
  };
  log.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function clearOrderLog(): void {
  localStorage.setItem(STORAGE_KEY, "[]");
}
