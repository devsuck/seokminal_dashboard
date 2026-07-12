// hooks/useOrderflowSocket.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";
import {
  applyOrderflowMessage,
  applySnapshot,
  emptyOrderflowState,
  type FootprintCell,
  type HeatmapCell,
  type OrderBookState,
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
  book: OrderBookState;
  connectionState: OrderflowConnectionState;
}

function isSnapshotMsg(msg: unknown): msg is { type: "snapshot" } & OrderflowSnapshot {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "snapshot";
}

export function useOrderflowSocket(symbol: string): UseOrderflowSocketResult {
  const [state, setState] = useState<OrderflowState>(emptyOrderflowState);
  const [connectionState, setConnectionState] = useState<OrderflowConnectionState>("connecting");

  // 초당 수백 건 오는 delta 메시지마다 setState(리렌더)하면 브라우저가 못 버틴다.
  // 메시지는 ref에 즉시 반영하고, 화면 반영은 rAF 1프레임당 1회로 묶어서 흘려보낸다.
  const pendingRef = useRef<OrderflowState>(emptyOrderflowState());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    pendingRef.current = emptyOrderflowState();
    setState(emptyOrderflowState());
    setConnectionState("connecting");

    function flush() {
      rafIdRef.current = null;
      setState(pendingRef.current);
    }

    function scheduleFlush() {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(flush);
    }

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
          pendingRef.current = applySnapshot(msg);
          scheduleFlush();
          setConnectionState("live");
          return;
        }
        const parsed = msg as OrderflowDeltaMsg;
        if (parsed.type === "status") {
          setConnectionState(parsed.state === "live" ? "live" : "reconnecting");
          return;
        }
        pendingRef.current = applyOrderflowMessage(pendingRef.current, parsed);
        scheduleFlush();
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
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      ws?.close();
    };
  }, [symbol]);

  return {
    footprint: Array.from(state.footprint.values()),
    heatmap: Array.from(state.heatmap.values()),
    book: state.book,
    connectionState,
  };
}
