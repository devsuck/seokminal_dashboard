// Client-side per-symbol price alerts (localStorage). Checked on the market page.
export interface PriceAlert {
  id: string;
  symbol: string;              // e.g. "AAPL.NASDAQ" | "005930.XKRX"
  direction: "above" | "below";
  price: number;
  triggered: boolean;
  created_at: string;
}

const KEY = "seokminal:price-alerts";

export function getPriceAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

function save(a: PriceAlert[]): PriceAlert[] {
  localStorage.setItem(KEY, JSON.stringify(a));
  return a;
}

export function addPriceAlert(symbol: string, direction: "above" | "below", price: number): PriceAlert[] {
  const a = getPriceAlerts();
  a.push({ id: crypto.randomUUID(), symbol, direction, price, triggered: false, created_at: new Date().toISOString() });
  return save(a);
}

export function removePriceAlert(id: string): PriceAlert[] {
  return save(getPriceAlerts().filter(x => x.id !== id));
}

export function markTriggered(id: string): PriceAlert[] {
  return save(getPriceAlerts().map(x => (x.id === id ? { ...x, triggered: true } : x)));
}
