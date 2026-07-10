// hooks/useOptionsFlowSocket.ts
"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/lib/api";

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;
const MAX_TRADES = 100;

export type OptionsFlowConnectionState = "connecting" | "live" | "reconnecting" | "error";

export interface OptionTrade {
  instrument_name: string;
  direction: "buy" | "sell";
  price: number;
  amount: number;
  iv: number;
  index_price: number;
  timestamp: number;
}

interface UseOptionsFlowSocketResult {
  trades: OptionTrade[];
  connectionState: OptionsFlowConnectionState;
}

function isTradeMsg(msg: unknown): msg is { type: "trade" } & OptionTrade {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "trade";
}

function isStatusMsg(msg: unknown): msg is { type: "status"; state: string } {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "status";
}

export function useOptionsFlowSocket(currency: string): UseOptionsFlowSocketResult {
  const [trades, setTrades] = useState<OptionTrade[]>([]);
  const [connectionState, setConnectionState] = useState<OptionsFlowConnectionState>("connecting");

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    setTrades([]);
    setConnectionState("connecting");

    function connect() {
      ws = new WebSocket(`${WS_URL}/ws/options-flow/${encodeURIComponent(currency)}`);

      ws.onopen = () => {
        delay = RECONNECT_BASE_DELAY_MS;
      };

      ws.onmessage = (evt) => {
        if (closedByEffect) return;
        let msg: unknown;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (isStatusMsg(msg)) {
          setConnectionState(msg.state === "live" ? "live" : "reconnecting");
          return;
        }
        if (isTradeMsg(msg)) {
          setConnectionState("live");
          setTrades((prev) => [msg, ...prev].slice(0, MAX_TRADES));
        }
      };

      ws.onerror = () => {
        if (closedByEffect) return;
        setConnectionState("error");
      };

      ws.onclose = () => {
        if (closedByEffect) return;
        setConnectionState("reconnecting");
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currency]);

  return { trades, connectionState };
}
