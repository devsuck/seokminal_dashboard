"use client";

import { useEffect, useRef, useState } from "react";
import {
  placeKROrder,
  cancelKROrder,
  getKROrderStatus,
  placeUSOrder,
  cancelUSOrder,
  getAllBotsLiveStatus,
  type KROrderResponse,
  type USOrderResponse,
  type BotLiveEntry,
} from "@/lib/api";
import {
  getOrderLog,
  addOrderEntry,
  updateOrderStatus,
  clearOrderLog,
  type OrderLogEntry,
} from "@/lib/order-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

type Venue = "KR" | "US";
type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPnl(pnl: number | null): string {
  if (pnl === null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}`;
}

function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-text-3";
  return pnl >= 0 ? "text-pos" : "text-neg";
}

function canCancel(status: string): boolean {
  return ["SUBMITTED", "OPEN", "PendingSubmit", "PreSubmitted"].includes(status);
}

function toKRDate(isoStr: string): string {
  return isoStr.slice(0, 10).replace(/-/g, "");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Venue tab
  const [venue, setVenue] = useState<Venue>("KR");

  // Shared form
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");

  // KR form
  const [krCode, setKrCode] = useState("005930");
  const [krPrice, setKrPrice] = useState("");

  // US form
  const [usSymbol, setUsSymbol] = useState("AAPL");
  const [usLimitPrice, setUsLimitPrice] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Per-order action state: { [entryId]: { loading, error } }
  const [actionState, setActionState] = useState<Record<string, { loading: boolean; error: string | null }>>({});
  const cancelAbortRefs = useRef<Map<string, AbortController>>(new Map());

  // Bot positions
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(true);
  const botsAbortRef = useRef<AbortController | null>(null);

  // Order log
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);

  useEffect(() => {
    setOrderLog(getOrderLog());
  }, []);

  useEffect(() => () => {
    submitAbortRef.current?.abort();
    botsAbortRef.current?.abort();
    cancelAbortRefs.current.forEach(c => c.abort());
    cancelAbortRefs.current.clear();
  }, []);

  // ── Place order ───────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    const qtyNum = parseInt(qty);
    if (qtyNum <= 0 || isNaN(qtyNum)) { setSubmitError("Qty must be > 0."); return; }

    if (venue === "KR") {
      if (!krCode.trim()) { setSubmitError("Code required."); return; }
      if (orderType === "LIMIT" && (!krPrice || isNaN(parseInt(krPrice)))) {
        setSubmitError("Price required for LIMIT."); return;
      }
    } else {
      if (!usSymbol.trim()) { setSubmitError("Symbol required."); return; }
      if (orderType === "LIMIT" && (!usLimitPrice || isNaN(parseFloat(usLimitPrice)))) {
        setSubmitError("Limit price required for LIMIT."); return;
      }
    }

    submitAbortRef.current?.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setSubmitting(true); setSubmitResult(null); setSubmitError(null);

    try {
      let resultStr: string;
      if (venue === "KR") {
        const res: KROrderResponse = await placeKROrder({
          code: krCode.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "KR", code: krCode.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseInt(krPrice) } : {}),
          order_id: res.order_id, status: res.status,
        });
        setOrderLog(updated);
      } else {
        const res: USOrderResponse = await placeUSOrder({
          symbol: usSymbol.trim(), side, quantity: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { limit_price: parseFloat(usLimitPrice) } : {}),
        }, ctrl.signal);
        if (submitAbortRef.current !== ctrl) return;
        resultStr = `#${res.order_id} · ${res.status}`;
        const updated = addOrderEntry({
          venue: "US", code: usSymbol.trim(), side, qty: qtyNum, order_type: orderType,
          ...(orderType === "LIMIT" ? { price: parseFloat(usLimitPrice) } : {}),
          order_id: String(res.order_id), status: res.status,
        });
        setOrderLog(updated);
      }
      setSubmitResult(resultStr);
    } catch (e) {
      if (submitAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      if (submitAbortRef.current === ctrl) setSubmitting(false);
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────

  async function handleCancel(entry: OrderLogEntry) {
    cancelAbortRefs.current.get(entry.id)?.abort();
    cancelAbortRefs.current.delete(entry.id);
    const ctrl = new AbortController();
    cancelAbortRefs.current.set(entry.id, ctrl);
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      if (entry.venue === "KR") {
        const res = await cancelKROrder(entry.order_id, { code: entry.code, quantity: entry.qty }, ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      } else {
        const res = await cancelUSOrder(Number(entry.order_id), ctrl.signal);
        const updated = updateOrderStatus(entry.id, res.status);
        setOrderLog(updated);
      }
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    } finally {
      if (cancelAbortRefs.current.get(entry.id) === ctrl) cancelAbortRefs.current.delete(entry.id);
    }
  }

  // ── Check status (KR only) ─────────────────────────────────────────────────

  async function handleCheckStatus(entry: OrderLogEntry) {
    cancelAbortRefs.current.get(entry.id)?.abort();
    cancelAbortRefs.current.delete(entry.id);
    const ctrl = new AbortController();
    cancelAbortRefs.current.set(entry.id, ctrl);
    setActionState(s => ({ ...s, [entry.id]: { loading: true, error: null } }));
    try {
      const date = toKRDate(entry.submitted_at);
      const res = await getKROrderStatus(entry.order_id, date, ctrl.signal);
      const updated = updateOrderStatus(entry.id, res.status);
      setOrderLog(updated);
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: null } }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionState(s => ({ ...s, [entry.id]: { loading: false, error: e instanceof Error ? e.message : String(e) } }));
    } finally {
      if (cancelAbortRefs.current.get(entry.id) === ctrl) cancelAbortRefs.current.delete(entry.id);
    }
  }

  // ── Refresh bots ──────────────────────────────────────────────────────────

  async function handleRefreshBots() {
    botsAbortRef.current?.abort();
    const ctrl = new AbortController();
    botsAbortRef.current = ctrl;
    setBotsLoading(true); setBotsError(null);
    try {
      const res = await getAllBotsLiveStatus(ctrl.signal);
      if (botsAbortRef.current !== ctrl) return;
      setBots(res.bots);
    } catch (e) {
      if (botsAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setBotsError(e instanceof Error ? e.message : String(e));
    } finally {
      if (botsAbortRef.current === ctrl) setBotsLoading(false);
    }
  }

  useEffect(() => { handleRefreshBots(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClearLog() { clearOrderLog(); setOrderLog([]); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <h1 className="text-xl font-bold mb-6">Live Order Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Order Form + Log ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">

            {/* Venue tabs */}
            <div className="flex rounded overflow-hidden border border-border w-fit mb-4">
              {(["KR", "US"] as Venue[]).map(v => (
                <button
                  key={v}
                  className={`px-5 py-1.5 text-sm font-medium ${
                    venue === v
                      ? "border-accent text-accent bg-accent/10"
                      : "bg-panel-2 text-text-2 hover:bg-panel"
                  }`}
                  onClick={() => { setVenue(v); setSubmitResult(null); setSubmitError(null); }}
                >
                  {v}
                </button>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              {venue === "KR" ? "KR Manual Order" : "US Manual Order"}
            </h2>

            <div className="space-y-3">
              {/* Code / Symbol */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">
                  {venue === "KR" ? "Code" : "Symbol"}
                </label>
                {venue === "KR" ? (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="005930"
                    value={krCode}
                    onChange={e => setKrCode(e.target.value)}
                  />
                ) : (
                  <input
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono uppercase"
                    placeholder="AAPL"
                    value={usSymbol}
                    onChange={e => setUsSymbol(e.target.value.toUpperCase())}
                  />
                )}
              </div>

              {/* Side */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["BUY", "SELL"] as Side[]).map(s => (
                    <button
                      key={s}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        side === s
                          ? s === "BUY" ? "bg-pos text-bg" : "bg-neg text-bg"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setSide(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Qty</label>
                <input
                  type="number"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>

              {/* Order type */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Type</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["MARKET", "LIMIT"] as OrderType[]).map(t => (
                    <button
                      key={t}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        orderType === t
                          ? "border-accent text-accent bg-accent/10"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setOrderType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (LIMIT only) */}
              {orderType === "LIMIT" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Price</label>
                  {venue === "KR" ? (
                    <input
                      type="number"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (KRW)"
                      value={krPrice}
                      onChange={e => setKrPrice(e.target.value)}
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                      placeholder="limit price (USD)"
                      value={usLimitPrice}
                      onChange={e => setUsLimitPrice(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-5 py-2 disabled:opacity-40"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? "Placing…" : "Place Order"}
              </button>
              {submitResult && <span className="text-sm text-pos font-mono">{submitResult}</span>}
              {submitError && <span className="text-sm text-neg">{submitError}</span>}
            </div>
          </div>

          {/* Order Log */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Order Log</h2>
              {orderLog.length > 0 && (
                <button className="text-xs text-neg hover:underline" onClick={handleClearLog}>
                  Clear
                </button>
              )}
            </div>
            {orderLog.length === 0 ? (
              <p className="text-sm text-text-3">No orders placed yet.</p>
            ) : (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Venue</th>
                      <th className="py-1 text-left font-medium">Code</th>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-left font-medium">ID</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderLog].reverse().map(entry => {
                      const act = actionState[entry.id];
                      return (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="py-1.5 text-text-3">{entry.venue}</td>
                          <td className="py-1.5 text-text-1 font-mono">{entry.code}</td>
                          <td className={`py-1.5 font-medium ${entry.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {entry.side}
                          </td>
                          <td className="py-1.5 text-text-1 text-right">{entry.qty}</td>
                          <td className="py-1.5 text-text-2 font-mono">{entry.order_id}</td>
                          <td className="py-1.5 text-text-2">{entry.status}</td>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1">
                              {canCancel(entry.status) && (
                                <button
                                  className="text-xs text-neg border border-neg/50 rounded px-2 py-0.5 hover:bg-neg/10 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCancel(entry)}
                                >
                                  {act?.loading ? "…" : "Cancel"}
                                </button>
                              )}
                              {entry.venue === "KR" && (
                                <button
                                  className="text-xs border border-border text-text-2 rounded px-2 py-0.5 hover:bg-panel-2 disabled:opacity-40"
                                  disabled={act?.loading}
                                  onClick={() => handleCheckStatus(entry)}
                                >
                                  {act?.loading ? "…" : "Check"}
                                </button>
                              )}
                              {act?.error && (
                                <span className="text-neg text-xs ml-1">{act.error}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Bot Positions ── */}
        <section>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">Bot Positions</h2>
              <button
                className="bg-accent text-black text-xs font-medium rounded px-3 py-1 disabled:opacity-40"
                onClick={handleRefreshBots}
                disabled={botsLoading}
              >
                {botsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {botsError && <p className="text-sm text-neg mb-2">{botsError}</p>}

            {bots.length === 0 && !botsLoading && !botsError ? (
              <p className="text-sm text-text-3">No bots found.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Bot</th>
                      <th className="py-1 text-left font-medium">Instrument</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Pos</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Entry</th>
                      <th className="py-1 text-right font-medium">Unr. PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.bot_id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono text-xs">{bot.bot_id}</td>
                        <td className="py-1.5 text-text-2">{bot.instrument_id}</td>
                        <td className="py-1.5">
                          <span className={`font-medium ${bot.running ? "text-pos" : "text-text-3"}`}>
                            {bot.running ? "RUNNING" : "STOPPED"}
                          </span>
                        </td>
                        <td className={`py-1.5 font-medium ${
                          bot.position === "LONG" ? "text-pos"
                            : bot.position === "SHORT" ? "text-neg"
                            : "text-text-3"
                        }`}>
                          {bot.position}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{bot.qty}</td>
                        <td className="py-1.5 text-text-1 text-right font-mono">
                          {bot.last_price != null ? bot.last_price.toFixed(2) : "—"}
                        </td>
                        <td className="py-1.5 text-text-2 text-right font-mono">
                          {bot.entry_price != null ? bot.entry_price.toFixed(2) : "—"}
                        </td>
                        <td className={`py-1.5 text-right font-mono font-medium ${pnlColor(bot.unrealized_pnl)}`}>
                          {fmtPnl(bot.unrealized_pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bots.some(b => b.error) && (
              <div className="mt-3 space-y-1">
                {bots.filter(b => b.error).map(b => (
                  <p key={b.bot_id} className="text-xs text-neg">{b.bot_id}: {b.error}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
