"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { WS_URL, type IBTick } from "@/lib/api";

const TICKERS = ["AAPL", "SPY", "QQQ"];

type ConnState = "connecting" | "live" | "off";

interface Row {
  price: number | null;
  size: number | null;
  prevPrice: number | null;
  status: ConnState;
}

const INITIAL: Row = { price: null, size: null, prevPrice: null, status: "connecting" };

export function IbRealtimeWidget() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Record<string, Row>>(
    () => Object.fromEntries(TICKERS.map(s => [s, { ...INITIAL }])),
  );
  const socketsRef = useRef<WebSocket[]>([]);

  useEffect(() => {
    const sockets: WebSocket[] = [];

    for (const symbol of TICKERS) {
      const ws = new WebSocket(`${WS_URL}/ws/ib/live/${symbol}`);
      sockets.push(ws);

      ws.onopen = () => {
        setRows(prev => ({ ...prev, [symbol]: { ...prev[symbol], status: "live" } }));
      };
      ws.onclose = () => {
        setRows(prev => ({ ...prev, [symbol]: { ...prev[symbol], status: "off" } }));
      };
      ws.onerror = () => {
        setRows(prev => ({ ...prev, [symbol]: { ...prev[symbol], status: "off" } }));
      };
      ws.onmessage = (evt) => {
        try {
          const tick = JSON.parse(evt.data) as IBTick;
          if (tick.error) {
            setRows(prev => ({ ...prev, [symbol]: { ...prev[symbol], status: "off" } }));
            return;
          }
          setRows(prev => {
            const cur = prev[symbol];
            return {
              ...prev,
              [symbol]: {
                price: tick.price,
                size: tick.size,
                prevPrice: cur.price,
                status: "live",
              },
            };
          });
        } catch { /* ignore malformed frame */ }
      };
    }

    socketsRef.current = sockets;
    return () => {
      for (const ws of sockets) ws.close();
      socketsRef.current = [];
    };
  }, []);

  // Overall badge: live if any symbol streaming, connecting while sockets open, else offline.
  const states = TICKERS.map(s => rows[s].status);
  const anyLive = states.includes("live");
  const anyConnecting = states.includes("connecting");
  const badge: ConnState = anyLive ? "live" : anyConnecting ? "connecting" : "off";

  const badgeLabel =
    badge === "live" ? t("ib.live.connected")
    : badge === "connecting" ? t("ib.live.connecting")
    : t("ib.live.offline");
  const badgeColor = badge === "live" ? "text-pos" : badge === "connecting" ? "text-warn" : "text-text-3";
  const dotColor = badge === "live" ? "bg-pos" : badge === "connecting" ? "bg-warn" : "bg-text-3";

  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold">
          {t("ib.live.title")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${badge !== "off" ? "animate-pulse" : ""}`} />
          <span className={`text-[11px] font-data ${badgeColor}`}>{badgeLabel}</span>
        </div>
      </div>

      {badge === "off" && (
        <p className="text-text-3 text-xs mb-3">{t("ib.live.desc")}</p>
      )}

      <div className="space-y-1">
        {TICKERS.map(symbol => {
          const r = rows[symbol];
          const up = r.price !== null && r.prevPrice !== null && r.price > r.prevPrice;
          const down = r.price !== null && r.prevPrice !== null && r.price < r.prevPrice;
          const priceColor = up ? "text-pos" : down ? "text-neg" : "text-text-1";
          return (
            <div key={symbol} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-text-2 text-xs font-data">{symbol}</span>
              <div className="flex items-center gap-3">
                {r.price !== null ? (
                  <>
                    <span className={`text-xs font-data tabular-nums ${priceColor}`}>
                      {up ? "▲" : down ? "▼" : ""} {r.price.toFixed(2)}
                    </span>
                    <span className="text-text-3 text-[10px] font-data w-12 text-right">
                      {r.size !== null ? `×${r.size}` : ""}
                    </span>
                  </>
                ) : r.status === "off" ? (
                  <span className="text-text-3 text-[10px]">{t("ib.live.offline")}</span>
                ) : (
                  <span className="text-text-3 text-[10px]">{t("ib.live.waiting_tick")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
