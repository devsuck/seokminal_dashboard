const STORAGE_KEY = "nautilus:watchlist";

export const DEFAULT_SYMBOLS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "005930.XKRX",
  "000660.XKRX",
];

export function getWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SYMBOLS];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_SYMBOLS];
  } catch {
    return [...DEFAULT_SYMBOLS];
  }
}

export function addToWatchlist(symbol: string): void {
  const list = getWatchlist();
  if (list.includes(symbol)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, symbol]));
}

export function removeFromWatchlist(symbol: string): void {
  const updated = getWatchlist().filter(s => s !== symbol);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol);
}
