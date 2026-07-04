"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import {
  ApiError, listBots, createBot, startBot, stopBot, deleteBot,
  getBars, getBacktest, getLiveBotStatus,
  type BotRecord, type BotConfig, type BarOut, type BacktestResponse,
  type LiveBotStatus,
} from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const INSTRUMENTS = ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX", "000660.XKRX"];

const DEFAULT_FORM: BotConfig = { name: "", strategy: "ema_cross", instrument_id: "AAPL.NASDAQ", fast_ema: 10, slow_ema: 20, trade_size: 10 };

// ── Bot Detail Panel ──────────────────────────────────────────────────────────
function BotDetail({ bot, onUpdate }: { bot: BotRecord; onUpdate: (b: BotRecord) => void }) {
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [btResult, setBtResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveBotStatus | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll live status every 5 seconds when bot is running
  useEffect(() => {
    if (bot.status !== "running") { setLiveStatus(null); return; }
    let alive = true;
    const poll = async () => {
      try { const s = await getLiveBotStatus(bot.id); if (alive) setLiveStatus(s); } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(interval); };
  }, [bot.id, bot.status]);

  // WebSocket for real-time price when running
  useEffect(() => {
    if (bot.status !== "running") { wsRef.current?.close(); wsRef.current = null; return; }
    const wsUrl = API_URL.replace("http", "ws") + `/ws/bots/${bot.id}/prices`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try { const d = JSON.parse(e.data); setLivePrice(d.price); } catch {}
    };
    ws.onerror = () => {};
    return () => { ws.close(); wsRef.current = null; };
  }, [bot.id, bot.status]);

  async function runPreview() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null); setBtResult(null); setBars([]);
    try {
      const [barsRes, btRes] = await Promise.all([
        getBars(bot.instrument_id, start, end, undefined, ctrl.signal),
        getBacktest(bot.instrument_id, start, end, "ema_cross", { fast: String(bot.fast_ema), slow: String(bot.slow_ema) }, undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars); setBtResult(btRes);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Preview failed");
    } finally { setLoading(false); }
  }

  async function toggle() {
    try {
      const updated = bot.status === "running" ? await stopBot(bot.id) : await startBot(bot.id);
      onUpdate(updated);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Toggle failed"); }
  }

  const configRows = [
    { k: "ID",        v: bot.id },
    { k: "STRATEGY",  v: bot.strategy.toUpperCase() },
    { k: "SYMBOL",    v: bot.instrument_id },
    { k: "FAST EMA",  v: String(bot.fast_ema) },
    { k: "SLOW EMA",  v: String(bot.slow_ema) },
    { k: "SIZE",      v: String(bot.trade_size) },
    { k: "CREATED",   v: bot.created_at.slice(0, 16).replace("T", " ") },
  ];

  const stats = btResult ? [
    { label: "Total P&L",  val: btResult.total_pnl != null ? btResult.total_pnl.toFixed(2) : "N/A",
      className: btResult.total_pnl != null ? (btResult.total_pnl >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
    { label: "P&L %",      val: btResult.total_pnl_pct != null ? (btResult.total_pnl_pct * 100).toFixed(2) + "%" : "N/A",
      className: btResult.total_pnl_pct != null ? (btResult.total_pnl_pct >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
    { label: "Sharpe",     val: btResult.sharpe_ratio?.toFixed(4) ?? "N/A",
      className: btResult.sharpe_ratio != null ? (btResult.sharpe_ratio >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
    { label: "Max DD",     val: btResult.max_drawdown != null ? (btResult.max_drawdown * 100).toFixed(2) + "%" : "N/A",
      className: "text-neg" },
    { label: "Trades",     val: String(btResult.trades.length), className: "text-text-1" },
  ] : [];

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {/* Bot name + status + toggle */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-text-1 text-sm font-semibold">{bot.name}</span>
        <span className={`text-xs ${
          bot.status === "running" ? "text-pos" : bot.status === "error" ? "text-neg" : "text-text-3"}`}>● {bot.status}</span>
        <button onClick={toggle} className={`h-7 px-3 text-xs rounded border cursor-pointer bg-transparent hover:opacity-80 ${
          bot.status === "running"? "border-neg text-neg": "border-pos text-pos"}`}>
          {bot.status === "running" ? "Stop" : "Start"}
        </button>
      </div>

      {/* Live status panel */}
      {bot.status === "running" && (
        <div className="border border-border rounded-lg bg-panel-2 p-3 mb-4 max-w-sm">
          <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Live Status</div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <div className="text-text-3 text-[11px] uppercase">Last Price</div>
              <div className="text-text-1 text-base font-data font-semibold">
                {livePrice != null ? livePrice.toFixed(2) : liveStatus?.last_price?.toFixed(2) ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-text-3 text-[11px] uppercase">Position</div>
              <div className={`text-sm font-data font-semibold ${
                liveStatus?.position === "LONG" ? "text-pos": liveStatus?.position === "SHORT" ? "text-neg": "text-text-3"}`}>
                {liveStatus?.position ?? "FLAT"}{liveStatus?.qty ? ` ×${liveStatus.qty}` : ""}
              </div>
            </div>
            <div>
              <div className="text-text-3 text-[11px] uppercase">Signal</div>
              <div className={`text-sm font-data ${
                liveStatus?.last_signal?.includes("BUY") ? "text-pos": liveStatus?.last_signal?.includes("SELL") ? "text-neg": "text-text-3"}`}>
                {liveStatus?.last_signal ?? "—"}
              </div>
            </div>
          </div>
          {liveStatus?.error && (
            <div className="text-neg text-xs mt-1.5 font-data">{liveStatus.error}</div>
          )}
          {liveStatus?.recent_orders && liveStatus.recent_orders.length > 0 && (
            <div className="mt-2">
              <div className="text-text-3 text-[11px] uppercase mb-1">Recent Orders</div>
              {liveStatus.recent_orders.slice(-5).map((o, i) => (
                <div key={i} className="text-xs font-data text-text-3">
                  {o.order_id} · {o.status} · filled {o.filled}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config table */}
      <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Configuration</div>
      <table className="border-collapse mb-4">
        <tbody>
          {configRows.map(r => (
            <tr key={r.k} className="border-b border-border/40">
              <td className="py-1 pr-4 text-accent text-xs w-28">{r.k}</td>
              <td className="py-1 text-text-2 text-xs font-data">{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Backtest preview */}
      <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Backtest Preview</div>
      <div className="flex gap-2 items-center flex-wrap mb-3">
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button onClick={runPreview}
          className="h-7 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0">
          Run Preview
        </button>
        {loading && <span className="text-text-3 text-xs">Running…</span>}
      </div>
      {error && (
        <div className="text-neg text-xs bg-neg/10 border border-neg/20 rounded px-3 py-1.5 mb-3">
          {error}
        </div>
      )}

      {!loading && !error && btResult && bars.length > 0 && (
        <>
          {/* Stats row */}
          <div className="flex gap-5 flex-wrap mb-3">
            {stats.map(s => (
              <div key={s.label}>
                <div className="text-text-3 text-[11px] uppercase">{s.label}</div>
                <div className={`text-sm font-data font-semibold ${s.className}`}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* EMA legend */}
          <div className="flex gap-3 text-xs mb-2 text-text-3">
            <span><span className="text-accent">—</span> EMA {bot.fast_ema}</span>
            <span><span className="text-info">—</span> EMA {bot.slow_ema}</span>
            <span><span className="text-pos">▲</span> Buy</span>
            <span><span className="text-neg">▼</span> Sell</span>
          </div>
          <CandlestickChart bars={bars} trades={btResult.trades} emaFast={bot.fast_ema} emaSlow={bot.slow_ema} />

          {btResult.trades.length > 0 && (
            <div className="mt-4">
              <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">
                Trade Log ({btResult.trades.length})
              </div>
              <div className="overflow-x-auto">
                <table className="border-collapse min-w-[640px]">
                  <thead>
                    <tr>
                      {["#","Side","Entry","Entry Px","Exit","Exit Px","Qty","P&L"].map(h => (
                        <th key={h}
                          className="pb-2 pt-1 pr-3 text-accent text-xs font-normal text-left border-b border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {btResult.trades.map((t, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-3 border-b border-border/40">{i + 1}</td>
                        <td className={`py-1.5 pr-3 text-xs font-data border-b border-border/40 ${t.side === "LONG" ? "text-pos" : "text-neg"}`}>{t.side}</td>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">
                          {new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-1 border-b border-border/40">{t.entry_price.toFixed(2)}</td>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">
                          {t.exit_ts_ns ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-1 border-b border-border/40">{t.exit_price?.toFixed(2) ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">{t.qty.toFixed(0)}</td>
                        <td className={`py-1.5 pr-3 text-xs font-data font-semibold border-b border-border/40 ${
                          t.pnl != null ? (t.pnl >= 0 ? "text-pos" : "text-neg") : "text-text-3"}`}>
                          {t.pnl != null ? t.pnl.toFixed(2) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BotsPage() {
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BotConfig>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBots(await listBots()); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Load failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name required"); return; }
    setSubmitting(true); setError(null);
    try {
      const bot = await createBot(form);
      setBots(p => [...p, bot]);
      setShowForm(false); setForm(DEFAULT_FORM);
      setSelectedId(bot.id);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Create failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBot(id);
      setBots(p => p.filter(b => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
  }

  function handleBotUpdate(updated: BotRecord) {
    setBots(p => p.map(b => b.id === updated.id ? updated : b));
  }

  const selectedBot = bots.find(b => b.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden">
      <PageBanner pageKey="bots" />
    <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-56 border-r border-border bg-bg flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Trading Bots</div>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setShowForm(p => !p); setSelectedId(null); }}
              className="flex-1 h-7 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0">
              {showForm ? "✕ Cancel" : "+ New"}
            </button>
            <button
              onClick={load}
              className="h-7 px-2 border border-border text-text-3 text-xs rounded cursor-pointer hover:text-text-2 bg-transparent">
              ↺
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-text-3 text-xs">로딩 중…</div>}
          {bots.length === 0 && !loading && <div className="px-3 py-2 text-text-3 text-xs">No bots</div>}
          {bots.map(bot => (
            <div
              key={bot.id}
              onClick={() => { setSelectedId(bot.id); setShowForm(false); }}
              className={`px-3 py-2 cursor-pointer border-b border-border/50 border-l-2 transition-colors ${
                selectedId === bot.id
                  ? "border-l-accent bg-panel": "border-l-transparent hover:bg-panel/50"}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${selectedId === bot.id ? "text-text-1" : "text-text-2"}`}>
                  {bot.name}
                </span>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/bots/${bot.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-accent text-xs hover:underline px-1">
                    Detail
                  </Link>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(bot.id); }}
                    className="text-neg text-xs px-1 cursor-pointer bg-transparent border-0 hover:opacity-70">
                    ✕
                  </button>
                </div>
              </div>
              <div className={`text-xs mt-0.5 ${
                bot.status === "running" ? "text-pos" : bot.status === "error" ? "text-neg" : "text-text-3"}`}>
                ● {bot.status}
              </div>
              <div className="text-[11px] text-text-3 mt-0.5 font-data">{bot.instrument_id}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="px-3 py-2 text-neg text-xs border-t border-border">{error}</div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 overflow-y-auto">
        {showForm && (
          <div className="p-4 max-w-md border-b border-border">
            <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-3">New Bot</div>
            <form onSubmit={handleCreate} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Name</span>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="bot-name"className="h-7 flex-1 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"/>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Strategy</span>
                <select
                  value={form.strategy}
                  onChange={e => setForm(p => ({ ...p, strategy: e.target.value }))}
                  className="h-7 flex-1 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data">
                  <option value="ema_cross">EMA Cross</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Symbol</span>
                <select
                  value={form.instrument_id}
                  onChange={e => setForm(p => ({ ...p, instrument_id: e.target.value }))}
                  className="h-7 flex-1 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data">
                  {INSTRUMENTS.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Fast EMA</span>
                <input
                  type="number"value={form.fast_ema}
                  min={1}
                  onChange={e => setForm(p => ({ ...p, fast_ema: Number(e.target.value) }))}
                  className="h-7 w-16 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"/>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Slow EMA</span>
                <input
                  type="number"value={form.slow_ema}
                  min={1}
                  onChange={e => setForm(p => ({ ...p, slow_ema: Number(e.target.value) }))}
                  className="h-7 w-16 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"/>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs w-24 shrink-0">Trade Size</span>
                <input
                  type="number"value={form.trade_size}
                  min={1}
                  onChange={e => setForm(p => ({ ...p, trade_size: Number(e.target.value) }))}
                  className="h-7 w-16 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"/>
              </div>
              <button type="submit" disabled={submitting}
                className="mt-1 h-7 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? "Creating…" : "Create"}
              </button>
            </form>
          </div>
        )}

        {!showForm && !selectedBot && (
          <div className="p-6 text-text-3 text-sm">← Select a bot or create new</div>
        )}

        {!showForm && selectedBot && (
          <BotDetail bot={selectedBot} onUpdate={handleBotUpdate} />
        )}
      </div>
    </div>
    </div>
  );
}
