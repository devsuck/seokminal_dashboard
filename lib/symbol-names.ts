const STORAGE_KEY = "seokminal:symbol-names";

const DEFAULT_NAMES: Record<string, string> = {
  "AAPL.NASDAQ": "Apple",
  "MSFT.NASDAQ": "Microsoft",
  "005930.XKRX": "삼성전자",
  "000660.XKRX": "SK하이닉스",
};

function readCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getSymbolName(instrumentId: string): string | null {
  return readCache()[instrumentId] ?? DEFAULT_NAMES[instrumentId] ?? null;
}

export function setSymbolName(instrumentId: string, name: string): void {
  if (!name) return;
  const cache = readCache();
  if (cache[instrumentId] === name) return;
  cache[instrumentId] = name;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}
