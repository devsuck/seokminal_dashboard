import {
  getBars, getKRBars, getIBBars, getCryptoCandles,
  type BarOut, type KRBar, type IBBar, type CryptoCandle, type IBBarSize,
} from "@/lib/api";

export const CRYPTO_DAYS: Record<string, number> = { "1m": 1, "15m": 5, "1h": 30, "4h": 90, "1d": 180, "1M": 365 };

export const IB_INTRADAY_CONFIG: Record<string, { bar: IBBarSize; dur: string }> = {
  "1m": { bar: "1 min", dur: "2 D" },
  "15m": { bar: "15 mins", dur: "5 D" },
  "1h": { bar: "1 hour", dur: "1 M" },
  "4h": { bar: "4 hours", dur: "3 M" },
  "1d": { bar: "1 day", dur: "2 Y" },
  "1M": { bar: "1 month", dur: "10 Y" },
};

function krBarToBarOut(bar: KRBar): BarOut {
  const d = bar.date;
  const tsMs = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).getTime();
  return { ts_event: tsMs * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}

function ibBarToBarOut(bar: IBBar): BarOut {
  return { ts_event: bar.ts_ms * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}

function cryptoCandleToBarOut(c: CryptoCandle): BarOut {
  return { ts_event: c.time_ms * 1_000_000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 심볼 접미사(.HL=Hyperliquid, .XKRX=한국, 나머지=IB)별로 알맞은 캔들 API를 호출해 BarOut[]으로 정규화한다. */
export async function fetchBarsForSymbol(symbol: string, tfId: string, signal: AbortSignal): Promise<BarOut[]> {
  const venue = symbol.split(".").slice(1).join(".");
  const isDaily = tfId === "1d";
  const isIntraday = ["1m", "15m", "1h", "4h"].includes(tfId);
  const cfg = IB_INTRADAY_CONFIG[tfId] ?? IB_INTRADAY_CONFIG["1d"];

  if (venue === "HL") {
    const code = symbol.split(".")[0];
    const res = await getCryptoCandles(code, tfId, CRYPTO_DAYS[tfId] ?? 90, signal);
    if (res.candles.length === 0) throw new Error("빈 응답");
    return res.candles.map(cryptoCandleToBarOut);
  }

  if (venue === "XKRX") {
    if (isIntraday) {
      throw new Error("KR 인트라데이는 아직 미지원 — 하루/1달만 (미국은 IB로 분봉 지원)");
    }
    const code = symbol.split(".")[0];
    const res = await getKRBars(code, tfId === "1M" ? 1800 : 730, signal);
    if (res.bars.length === 0) throw new Error("빈 응답");
    return res.bars.map(krBarToBarOut);
  }

  if (isDaily) {
    try {
      const res = await getBars(symbol, oneYearAgo(), today(), undefined, signal);
      if (res.bars.length > 0) return res.bars;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
    const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: "2 Y", bar_size: "1 day" }, signal);
    if (res.bars.length === 0) throw new Error("빈 응답");
    return res.bars.map(ibBarToBarOut);
  }

  const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: cfg.dur, bar_size: cfg.bar }, signal);
  if (res.bars.length === 0) throw new Error("빈 응답 (IB 연결·구독 확인)");
  return res.bars.map(ibBarToBarOut);
}
