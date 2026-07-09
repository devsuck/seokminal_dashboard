// app/orderflow/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { LivePulse } from "@/components/Jarvis";
import { FootprintChart } from "@/components/orderflow/FootprintChart";
import { LiquidityHeatmap } from "@/components/orderflow/LiquidityHeatmap";
import { useOrderflowSocket, type OrderflowConnectionState } from "@/hooks/useOrderflowSocket";
import { getOrderflowSymbols } from "@/lib/api";

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
  const { footprint, heatmap, connectionState } = useOrderflowSocket(symbol);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    getOrderflowSymbols(ctrl.signal)
      .then((res) => setActiveSymbols(res.symbols))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setActiveSymbols([]);
      });
    return () => ctrl.abort();
  }, [symbol]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <InstrumentSelect value={symbol} onChange={setSymbol} />
        <LivePulse tone={CONNECTION_TONE[connectionState]} label={CONNECTION_LABEL[connectionState]} />
        {activeSymbols.length > 0 && (
          <span className="text-text-3 text-xs">현재 수집 중: {activeSymbols.join(", ")}</span>
        )}
      </div>
      <div>
        <h2 className="text-text-2 text-sm mb-2">풋프린트</h2>
        <FootprintChart cells={footprint} />
      </div>
      <div>
        <h2 className="text-text-2 text-sm mb-2">유동성 히트맵</h2>
        <LiquidityHeatmap cells={heatmap} />
      </div>
    </div>
  );
}
