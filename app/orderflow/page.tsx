// app/orderflow/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { LivePulse } from "@/components/Jarvis";
import { PageBanner } from "@/components/PageBanner";
import { OrderflowChart } from "@/components/orderflow/OrderflowChart";
import { useOrderflowSocket, type OrderflowConnectionState } from "@/hooks/useOrderflowSocket";
import { useGexSnapshot } from "@/hooks/useGexSnapshot";
import { useFundingSnapshot } from "@/hooks/useFundingSnapshot";
import { getOrderflowSymbols } from "@/lib/api";
import { currencyForSymbol, hlCoinForSymbol } from "@/lib/orderflow-data";

// 오더플로우 백엔드가 실제 지원하는 종목만 — 일반 InstrumentSelect의 전체 카탈로그(주식 등)는 여기 해당 없음.
// HL 코인: research/data/hl_funding_loader.py LIQUID_PERPS와 동기화. 선물: orderflow/ib_adapter.py _FUTURES_SYMBOLS.
const ORDERFLOW_SYMBOLS = [
  "BTC.HL", "ETH.HL", "SOL.HL", "AVAX.HL", "BNB.HL", "ARB.HL", "OP.HL", "LINK.HL", "LTC.HL", "DOGE.HL",
  "SUI.HL", "INJ.HL", "ATOM.HL", "DYDX.HL", "APT.HL", "MATIC.HL", "NEAR.HL", "TIA.HL", "SEI.HL", "ORDI.HL",
  "WLD.HL", "PEPE.HL", "CRV.HL", "AAVE.HL", "PAXG.HL",
  "NQ", "MNQ", "ES", "GC",
];

const CONNECTION_TONE: Record<OrderflowConnectionState, "pos" | "accent" | "neg"> = {
  connecting: "accent",
  live: "pos",
  reconnecting: "accent",
  error: "neg",
};

const CONNECTION_LABEL: Record<OrderflowConnectionState, string> = {
  connecting: "연결 중",
  live: "라이브",
  reconnecting: "재연결 중",
  error: "오류",
};

export default function OrderflowPage() {
  const [symbol, setSymbol] = useState("BTC.HL");
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { footprint, heatmap, book, tapeSpeed, spoofAlerts, recentTrades, liquidations, connectionState } =
    useOrderflowSocket(symbol);
  const currency = currencyForSymbol(symbol);
  const { gex } = useGexSnapshot(currency ?? "");
  const hlCoin = hlCoinForSymbol(symbol);
  const { funding } = useFundingSnapshot(hlCoin ?? "");

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let cancelled = false;
    getOrderflowSymbols(ctrl.signal)
      .then((res) => {
        if (!cancelled) setActiveSymbols(res.symbols);
      })
      .catch((e) => {
        if (!cancelled && (e as Error).name !== "AbortError") setActiveSymbols([]);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <PageBanner pageKey="orderflow" />
      <div className="flex items-center gap-4">
        <InstrumentSelect value={symbol} onChange={setSymbol} instruments={ORDERFLOW_SYMBOLS} />
        <LivePulse tone={CONNECTION_TONE[connectionState]} label={CONNECTION_LABEL[connectionState]} />
        {activeSymbols.length > 0 && (
          <span className="text-text-3 text-xs">현재 수집 중: {activeSymbols.join(", ")}</span>
        )}
      </div>
      <OrderflowChart
        symbol={symbol}
        footprint={footprint}
        heatmap={heatmap}
        book={book}
        tapeSpeed={tapeSpeed}
        spoofAlerts={spoofAlerts}
        recentTrades={recentTrades}
        liquidations={liquidations}
        gex={gex}
        funding={funding}
      />
    </div>
  );
}
