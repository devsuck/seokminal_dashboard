"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import {
  ApiError, listBots, createBot, startBot, stopBot, deleteBot,
  getBars, getBacktest, getLiveBotStatus,
  type BotRecord, type BotConfig, type BarOut, type BacktestResponse,
  type LiveBotStatus,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const INSTRUMENTS = ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX", "000660.XKRX"];

const S = {
  btn:   { background: "#ff8c00", color: "#000", border: "none", padding: "5px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: "bold" as const, cursor: "pointer" },
  btnSm: { border: "1px solid #333", background: "transparent", color: "#aaa", padding: "3px 10px", fontFamily: "inherit", fontSize: 14, cursor: "pointer" } as const,
  label: { color: "#ff8c00", fontSize: 14 },
  err:   { color: "#ff3333", fontSize: 13 },
  muted: { color: "#777", fontSize: 13 },
  th:    { padding: "6px 14px 6px 0", color: "#ff8c00", fontSize: 14, fontWeight: "normal" as const, textAlign: "left" as const, borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap" as const },
  td:    { padding: "7px 14px 7px 0", fontSize: 13, fontFamily: "monospace", borderBottom: "1px solid #181818" },
  input: { fontSize: 13 },
};

function statusColor(s: string) { return s === "running" ? "#00cc44" : s === "error" ? "#ff3333" : "#555"; }
function pnlColor(v: number | null) { return v == null ? "#888" : v >= 0 ? "#00cc44" : "#ff3333"; }

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
    { label: "TOTAL PNL",   val: btResult.total_pnl != null ? btResult.total_pnl.toFixed(2) : "N/A", col: pnlColor(btResult.total_pnl) },
    { label: "TOTAL PNL %", val: btResult.total_pnl_pct != null ? (btResult.total_pnl_pct * 100).toFixed(2) + "%" : "N/A", col: pnlColor(btResult.total_pnl_pct) },
    { label: "SHARPE",      val: btResult.sharpe_ratio?.toFixed(4) ?? "N/A", col: pnlColor(btResult.sharpe_ratio) },
    { label: "MAX DD",      val: btResult.max_drawdown != null ? (btResult.max_drawdown * 100).toFixed(2) + "%" : "N/A", col: "#ff3333" },
    { label: "TRADES",      val: String(btResult.trades.length), col: "#e8e8e8" },
  ] : [];

  return (
    <div style={{ flex: 1, padding: 16, overflowY: "auto" as const }}>
      {/* Bot name + status + toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <span style={{ color: "#e8e8e8", fontSize: 14, fontWeight: "bold" }}>{bot.name}</span>
        <span style={{ color: statusColor(bot.status), fontSize: 13 }}>● {bot.status.toUpperCase()}</span>
        <button
          onClick={toggle}
          style={{ ...S.btnSm, color: bot.status === "running" ? "#ff8c00" : "#00cc44", borderColor: bot.status === "running" ? "#ff8c00" : "#00cc44" }}>
          {bot.status === "running" ? "STOP" : "START"}
        </button>
      </div>

      {/* Live status panel */}
      {bot.status === "running" && (
        <div style={{ border: "1px solid #2a2a2a", background: "#0d0d0d", padding: "10px 14px", marginBottom: 14, maxWidth: 480 }}>
          <div style={{ color: "#ff8c00", fontSize: 14, marginBottom: 8 }}>LIVE STATUS</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
            <div>
              <div style={{ color: "#ff8c00", fontSize: 13 }}>LAST PRICE</div>
              <div style={{ color: "#e8e8e8", fontSize: 16, fontFamily: "monospace", fontWeight: "bold" }}>
                {livePrice != null ? livePrice.toFixed(2) : liveStatus?.last_price?.toFixed(2) ?? "—"}
              </div>
            </div>
            <div>
              <div style={{ color: "#ff8c00", fontSize: 13 }}>POSITION</div>
              <div style={{ color: liveStatus?.position === "LONG" ? "#00cc44" : liveStatus?.position === "SHORT" ? "#ff3333" : "#555", fontSize: 14, fontFamily: "monospace", fontWeight: "bold" }}>
                {liveStatus?.position ?? "FLAT"} {liveStatus?.qty ? `×${liveStatus.qty}` : ""}
              </div>
            </div>
            <div>
              <div style={{ color: "#ff8c00", fontSize: 13 }}>SIGNAL</div>
              <div style={{ color: liveStatus?.last_signal === "EMA_BUY" ? "#00cc44" : liveStatus?.last_signal === "EMA_SELL" ? "#ff3333" : "#555", fontSize: 14, fontFamily: "monospace" }}>
                {liveStatus?.last_signal ?? "—"}
              </div>
            </div>
          </div>
          {liveStatus?.error && <div style={{ color: "#ff3333", fontSize: 14, marginTop: 6 }}>ERR: {liveStatus.error}</div>}
          {liveStatus?.recent_orders && liveStatus.recent_orders.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#ff8c00", fontSize: 13, marginBottom: 4 }}>RECENT ORDERS</div>
              {liveStatus.recent_orders.slice(-5).map((o, i) => (
                <div key={i} style={{ fontSize: 14, fontFamily: "monospace", color: "#888" }}>
                  {o.order_id} · {o.status} · filled {o.filled}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config table */}
      <div style={{ color: "#ff8c00", fontSize: 14, marginBottom: 6 }}>CONFIGURATION</div>
      <table style={{ borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          {configRows.map(r => (
            <tr key={r.k} style={{ borderBottom: "1px solid #181818" }}>
              <td style={{ padding: "4px 16px 4px 0", color: "#ff8c00", fontSize: 14, width: 120 }}>{r.k}</td>
              <td style={{ padding: "4px 0", color: "#888", fontSize: 14, fontFamily: "monospace" }}>{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Backtest preview */}
      <div style={{ color: "#ff8c00", fontSize: 14, marginBottom: 8 }}>BACKTEST PREVIEW</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" as const }}>
        <span style={S.label}>DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button style={S.btn} onClick={runPreview}>RUN PREVIEW</button>
        {loading && <span style={S.muted}>RUNNING...</span>}
      </div>
      {error && <div style={S.err}>ERR: {error}</div>}

      {!loading && !error && btResult && bars.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 20, marginBottom: 10, flexWrap: "wrap" as const }}>
            {stats.map(s => (
              <div key={s.label}>
                <div style={{ color: "#ff8c00", fontSize: 14 }}>{s.label}</div>
                <div style={{ color: s.col, fontSize: 15, fontFamily: "monospace", fontWeight: "bold" }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 6, display: "flex", gap: 12 }}>
            <span><span style={{ color: "#ff8c00" }}>—</span> EMA {bot.fast_ema}</span>
            <span><span style={{ color: "#4488ff" }}>—</span> EMA {bot.slow_ema}</span>
            <span><span style={{ color: "#00cc44" }}>▲</span> BUY</span>
            <span><span style={{ color: "#ff3333" }}>▼</span> SELL</span>
          </div>
          <CandlestickChart bars={bars} trades={btResult.trades} emaFast={bot.fast_ema} emaSlow={bot.slow_ema} />

          {btResult.trades.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: "#ff8c00", fontSize: 14, marginBottom: 6 }}>TRADE LOG ({btResult.trades.length})</div>
              <div style={{ overflowX: "auto" as const }}>
                <table style={{ borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      {["#", "SIDE", "ENTRY", "ENTRY PX", "EXIT", "EXIT PX", "QTY", "PNL"].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {btResult.trades.map((t, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, color: "#444" }}>{i + 1}</td>
                        <td style={{ ...S.td, color: t.side === "LONG" ? "#00cc44" : "#ff8c00" }}>{t.side}</td>
                        <td style={{ ...S.td, color: "#888" }}>{new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10)}</td>
                        <td style={{ ...S.td, color: "#e8e8e8" }}>{t.entry_price.toFixed(2)}</td>
                        <td style={{ ...S.td, color: "#888" }}>{t.exit_ts_ns ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10) : "—"}</td>
                        <td style={{ ...S.td, color: "#e8e8e8" }}>{t.exit_price?.toFixed(2) ?? "—"}</td>
                        <td style={{ ...S.td, color: "#888" }}>{t.qty.toFixed(0)}</td>
                        <td style={{ ...S.td, color: pnlColor(t.pnl), fontWeight: "bold" }}>{t.pnl != null ? t.pnl.toFixed(2) : "—"}</td>
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

  function field(label: string, node: React.ReactNode) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ ...S.label, width: 90 }}>{label}</span>
        {node}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 37px)", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 220, borderRight: "1px solid #2a2a2a", background: "#0d0d0d", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2a2a" }}>
          <div style={{ color: "#ff8c00", fontSize: 14, letterSpacing: 1, marginBottom: 8 }}>TRADING BOTS</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ ...S.btn, fontSize: 14, padding: "2px 8px", flex: 1 }} onClick={() => { setShowForm(p => !p); setSelectedId(null); }}>
              {showForm ? "✕ CANCEL" : "+ NEW"}
            </button>
            <button style={S.btnSm} onClick={load}>↺</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" as const }}>
          {loading && <div style={{ padding: "8px 12px", ...S.muted }}>LOADING...</div>}
          {bots.length === 0 && !loading && <div style={{ padding: "8px 12px", ...S.muted }}>NO BOTS</div>}
          {bots.map(bot => (
            <div
              key={bot.id}
              onClick={() => { setSelectedId(bot.id); setShowForm(false); }}
              style={{
                padding: "8px 12px", cursor: "pointer",
                background: selectedId === bot.id ? "#1a1a1a" : "transparent",
                borderBottom: "1px solid #181818",
                borderLeft: selectedId === bot.id ? "2px solid #ff8c00" : "2px solid transparent",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: selectedId === bot.id ? "#e8e8e8" : "#888", fontSize: 14 }}>{bot.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(bot.id); }}
                  style={{ ...S.btnSm, fontSize: 13, padding: "1px 5px", color: "#ff3333", borderColor: "#ff3333" }}>✕</button>
              </div>
              <div style={{ fontSize: 14, color: statusColor(bot.status), marginTop: 2 }}>
                ● {bot.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: "#444", marginTop: 1 }}>{bot.instrument_id}</div>
            </div>
          ))}
        </div>

        {error && <div style={{ padding: "6px 12px", ...S.err }}>{error}</div>}
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, overflowY: "auto" as const }}>
        {showForm && (
          <div style={{ padding: 16, maxWidth: 440, borderBottom: "1px solid #2a2a2a" }}>
            <div style={{ color: "#ff8c00", fontSize: 14, marginBottom: 12 }}>NEW BOT</div>
            <form onSubmit={handleCreate}>
              {field("NAME",      <input style={S.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="bot-name" />)}
              {field("STRATEGY",  <select style={S.input} value={form.strategy} onChange={e => setForm(p => ({ ...p, strategy: e.target.value }))}><option value="ema_cross">EMA CROSS</option></select>)}
              {field("SYMBOL",    <select style={S.input} value={form.instrument_id} onChange={e => setForm(p => ({ ...p, instrument_id: e.target.value }))}>{INSTRUMENTS.map(id => <option key={id} value={id}>{id}</option>)}</select>)}
              {field("FAST EMA",  <input type="number" style={{ ...S.input, width: 56 }} value={form.fast_ema} min={1} onChange={e => setForm(p => ({ ...p, fast_ema: Number(e.target.value) }))} />)}
              {field("SLOW EMA",  <input type="number" style={{ ...S.input, width: 56 }} value={form.slow_ema} min={1} onChange={e => setForm(p => ({ ...p, slow_ema: Number(e.target.value) }))} />)}
              {field("TRADE SIZE",<input type="number" style={{ ...S.input, width: 56 }} value={form.trade_size} min={1} onChange={e => setForm(p => ({ ...p, trade_size: Number(e.target.value) }))} />)}
              <button type="submit" style={{ ...S.btn, marginTop: 8 }} disabled={submitting}>{submitting ? "CREATING..." : "CREATE"}</button>
            </form>
          </div>
        )}

        {!showForm && !selectedBot && (
          <div style={{ padding: 24, color: "#333", fontSize: 14 }}>← SELECT A BOT OR CREATE NEW</div>
        )}

        {!showForm && selectedBot && (
          <BotDetail bot={selectedBot} onUpdate={handleBotUpdate} />
        )}
      </div>
    </div>
  );
}
