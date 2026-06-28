export interface OrderLogEntry {
  id: string;
  venue: "KR" | "US";
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
    id: crypto.randomUUID(),
    submitted_at: new Date().toISOString(),
  };
  log.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function updateOrderStatus(id: string, newStatus: string): OrderLogEntry[] {
  const log = getOrderLog();
  const entry = log.find(e => e.id === id);
  if (entry) entry.status = newStatus;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function clearOrderLog(): void {
  localStorage.setItem(STORAGE_KEY, "[]");
}
