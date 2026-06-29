"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getBot,
  fetchBotTrades,
  fetchBotSignals,
  getAllBotsLiveStatus,
} from "@/lib/api";
import type {
  BotRecord,
  BotLiveEntry,
  ClosedTrade,
  SignalEntry,
} from "@/lib/api";
import { RollingChart } from "@/components/rolling/RollingChart";
import type { RollingSeries } from "@/components/rolling/RollingChart";

type Tab = "trades" | "equity" | "signals";

const SIGNAL_CLASS: Record<string, string> = {
  EMA_BUY: "text-pos",
  EMA_SELL: "text-neg",
  HOLD: "text-text-2",
  WARMING_UP: "text-text-3",
};

function fmtTs(tsNs: number): string {
  return new Date(tsNs / 1_000_000).toLocaleString();
}

function fmtPnl(pnl: number): string {
  return (pnl >= 0 ? "+" : "") + pnl.toFixed(4);
}

function equitySeries(trades: ClosedTrade[]): RollingSeries[] {
  const sorted = [...trades].sort((a, b) => a.exit_ts_ns - b.exit_ts_ns);
  let cum = 0;
  const points = sorted.map((t) => {
    cum += t.pnl;
    return { ts_ns: t.exit_ts_ns, value: cum };
  });
  return [{ label: "Cumulative PnL", color: "#FF9F1C", points }];
}

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.id as string;

  const [bot, setBot] = useState<BotRecord | null>(null);
  const [live, setLive] = useState<BotLiveEntry | null>(null);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trades");
  const ctrlRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadAll() {
    if (ctrlRef.current) ctrlRef.current.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const [botData, tradesData, signalsData, liveData] = await Promise.all([
        getBot(botId),
        fetchBotTrades(botId, ctrl.signal),
        fetchBotSignals(botId, ctrl.signal),
        getAllBotsLiveStatus(ctrl.signal),
      ]);
      setBot(botData);
      setTrades(tradesData.trades);
      setSignals(signalsData.signals);
      setLive(liveData.bots.find((b) => b.bot_id === botId) ?? null);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  async function pollLive() {
    try {
      const data = await getAllBotsLiveStatus();
      setLive(data.bots.find((b) => b.bot_id === botId) ?? null);
    } catch {
      // silently ignore poll failures
    }
  }

  useEffect(() => {
    loadAll();
    pollRef.current = setInterval(pollLive, 5000);
    return () => {
      if (ctrlRef.current) ctrlRef.current.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [botId]);

  if (loading)
    return (
      <main className="min-h-screen bg-bg p-6">
        <p className="text-text-3 text-sm">Loading...</p>
      </main>
    );

  if (error)
    return (
      <main className="min-h-screen bg-bg p-6">
        <Link href="/bots" className="text-accent text-sm hover:underline">
          ← Bots
        </Link>
        <p className="text-neg text-sm mt-4">{error}</p>
      </main>
    );

  const TABS: { key: Tab; label: string }[] = [
    { key: "trades", label: "Trade Log" },
    { key: "equity", label: "Equity Curve" },
    { key: "signals", label: "Signal Log" },
  ];

  return (
    <main className="min-h-screen bg-bg p-6 space-y-6">
      {/* Back link */}
      <Link href="/bots" className="text-accent text-sm hover:underline">
        ← Bots
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-text-1 text-xl font-semibold">
          {bot?.name ?? botId}
        </h1>
        <span className="text-text-3 text-sm">{bot?.instrument_id}</span>
        {live && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              live.running
                ? "bg-pos/10 text-pos"
                : "bg-panel text-text-3"
            }`}
          >
            {live.running ? "Running" : "Stopped"}
          </span>
        )}
      </div>

      {/* Live status cards */}
      {live && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Position", value: live.position },
            { label: "Last Price", value: live.last_price?.toFixed(4) ?? "—" },
            {
              label: "Entry Price",
              value: live.entry_price?.toFixed(4) ?? "—",
            },
            {
              label: "Unrealized PnL",
              value:
                live.unrealized_pnl != null
                  ? fmtPnl(live.unrealized_pnl)
                  : "—",
              cls:
                live.unrealized_pnl != null
                  ? live.unrealized_pnl >= 0
                    ? "text-pos"
                    : "text-neg"
                  : "text-text-2",
            },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="bg-panel border border-border rounded p-3"
            >
              <p className="text-text-3 text-xs mb-1">{label}</p>
              <p className={`text-text-1 text-sm font-mono ${cls ?? ""}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Signal badge */}
      {live?.last_signal && (
        <p className="text-sm">
          <span className="text-text-3">Last signal: </span>
          <span
            className={SIGNAL_CLASS[live.last_signal] ?? "text-text-2"}
          >
            {live.last_signal}
          </span>
        </p>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 text-sm border-b-2 transition-colors ${
              tab === key
                ? "border-accent text-accent bg-accent/10 px-2 rounded-t"
                : "border-transparent text-text-3 hover:text-text-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "trades" && (
        <div>
          {trades.length === 0 ? (
            <p className="text-text-3 text-sm">No closed trades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-text-3 border-b border-border">
                    {["Exit Time", "Side", "Entry", "Exit", "Qty", "PnL"].map(
                      (h) => (
                        <th key={h} className="pb-2 pr-4 font-medium">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...trades].reverse().map((t, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-text-2 font-mono text-xs">
                        {fmtTs(t.exit_ts_ns)}
                      </td>
                      <td
                        className={`py-2 pr-4 font-medium ${
                          t.side === "LONG" ? "text-pos" : "text-neg"
                        }`}
                      >
                        {t.side}
                      </td>
                      <td className="py-2 pr-4 text-text-1 font-mono">
                        {t.entry_price.toFixed(4)}
                      </td>
                      <td className="py-2 pr-4 text-text-1 font-mono">
                        {t.exit_price.toFixed(4)}
                      </td>
                      <td className="py-2 pr-4 text-text-2">{t.qty}</td>
                      <td
                        className={`py-2 pr-4 font-mono font-medium ${
                          t.pnl >= 0 ? "text-pos" : "text-neg"
                        }`}
                      >
                        {fmtPnl(t.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "equity" && (
        <div>
          {trades.length === 0 ? (
            <p className="text-text-3 text-sm">No trades to chart yet.</p>
          ) : (
            <div style={{ height: "320px" }}>
              <RollingChart series={equitySeries(trades)} height={320} />
            </div>
          )}
        </div>
      )}

      {tab === "signals" && (
        <div>
          {signals.length === 0 ? (
            <p className="text-text-3 text-sm">
              No signal changes recorded yet.
            </p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {[...signals].reverse().map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-1.5 border-b border-border/30"
                >
                  <span className="text-text-3 text-xs font-mono w-44 shrink-0">
                    {fmtTs(s.ts_ns)}
                  </span>
                  <span
                    className={`text-sm font-medium w-24 shrink-0 ${
                      SIGNAL_CLASS[s.signal] ?? "text-text-2"
                    }`}
                  >
                    {s.signal}
                  </span>
                  <span className="text-text-2 text-sm font-mono">
                    {s.price.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
