// hooks/useOrderflowSocket.ts
"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/lib/api";
import {
  applyOrderflowMessage,
  applySnapshot,
  emptyOrderflowState,
  type FootprintCell,
  type HeatmapCell,
  type OrderflowDeltaMsg,
  type OrderflowSnapshot,
  type OrderflowState,
} from "@/lib/orderflow-data";

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;

export type OrderflowConnectionState = "connecting" | "live" | "reconnecting" | "error";

interface UseOrderflowSocketResult {
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  connectionState: OrderflowConnectionState;
}

function isSnapshotMsg(msg: unknown): msg is { type: "snapshot" } & OrderflowSnapshot {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "snapshot";
}

export function useOrderflowSocket(symbol: string): UseOrderflowSocketResult {
  const [state, setState] = useState<OrderflowState>(emptyOrderflowState);
  const [connectionState, setConnectionState] = useState<OrderflowConnectionState>("connecting");

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    setState(emptyOrderflowState());
    setConnectionState("connecting");

    function connect() {
      ws = new WebSocket(`${WS_URL}/ws/orderflow/${encodeURIComponent(symbol)}`);

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
        if (isSnapshotMsg(msg)) {
          setState(applySnapshot(msg));
          setConnectionState("live");
          return;
        }
        const parsed = msg as OrderflowDeltaMsg;
        if (parsed.type === "status") {
          setConnectionState(parsed.state === "live" ? "live" : "reconnecting");
          return;
        }
        setState((prev) => applyOrderflowMessage(prev, parsed));
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
  }, [symbol]);

  return {
    footprint: Array.from(state.footprint.values()),
    heatmap: Array.from(state.heatmap.values()),
    connectionState,
  };
}
