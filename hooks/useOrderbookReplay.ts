"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrderflowHistory, getOrderflowHistoryDates, type OrderflowHistorySnapshot } from "@/lib/api";

const PLAYBACK_INTERVAL_MS = 200;

interface UseOrderbookReplayResult {
  dates: string[];
  selectedDate: string | null;
  setSelectedDate: (date: string) => void;
  snapshots: OrderflowHistorySnapshot[];
  truncated: boolean;
  loading: boolean;
  index: number;
  setIndex: (index: number) => void;
  current: OrderflowHistorySnapshot | null;
  playing: boolean;
  play: () => void;
  pause: () => void;
}

/** symbol(HL 심볼만 지원)의 저장된 DOM 스냅샷을 날짜 단위로 불러와 재생 — 라이브 WS와 무관한 별도 상태. */
export function useOrderbookReplay(symbol: string): UseOrderbookReplayResult {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<OrderflowHistorySnapshot[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const datesAbortRef = useRef<AbortController | null>(null);
  const snapshotsAbortRef = useRef<AbortController | null>(null);

  // symbol 변경 — 사용 가능한 날짜 목록 재조회, 가장 최근 날짜 자동 선택
  useEffect(() => {
    datesAbortRef.current?.abort();
    const ctrl = new AbortController();
    datesAbortRef.current = ctrl;
    let cancelled = false;
    setDates([]);
    setSelectedDate(null);
    setSnapshots([]);
    setPlaying(false);
    setLoading(true);
    getOrderflowHistoryDates(symbol, ctrl.signal)
      .then((res) => {
        if (cancelled) return;
        setDates(res.dates);
        if (res.dates.length > 0) setSelectedDate(res.dates[res.dates.length - 1]);
      })
      .catch((e) => {
        if (!cancelled && (e as Error).name !== "AbortError") setDates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [symbol]);

  // 날짜 변경 — 해당 날짜 스냅샷 전체 조회
  useEffect(() => {
    if (!selectedDate) return;
    snapshotsAbortRef.current?.abort();
    const ctrl = new AbortController();
    snapshotsAbortRef.current = ctrl;
    let cancelled = false;
    setLoading(true);
    setPlaying(false);
    getOrderflowHistory(symbol, selectedDate, undefined, ctrl.signal)
      .then((res) => {
        if (cancelled) return;
        setSnapshots(res.snapshots);
        setTruncated(res.truncated);
        setIndex(0);
      })
      .catch((e) => {
        if (!cancelled && (e as Error).name !== "AbortError") {
          setSnapshots([]);
          setTruncated(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [symbol, selectedDate]);

  // 재생 — 마지막 프레임 도달 시 자동 정지
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        if (prev >= snapshots.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, snapshots.length]);

  const play = useCallback(() => {
    if (snapshots.length > 0) setPlaying(true);
  }, [snapshots.length]);
  const pause = useCallback(() => setPlaying(false), []);

  return {
    dates,
    selectedDate,
    setSelectedDate,
    snapshots,
    truncated,
    loading,
    index,
    setIndex,
    current: snapshots[index] ?? null,
    playing,
    play,
    pause,
  };
}
