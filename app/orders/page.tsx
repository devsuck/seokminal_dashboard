"use client";

import { useEffect, useRef, useState } from "react";
import {
  placeKROrder,
  getAllBotsLiveStatus,
  type KROrderResponse,
  type BotLiveEntry,
} from "@/lib/api";
import {
  getOrderLog,
  addOrderEntry,
  clearOrderLog,
  type OrderLogEntry,
} from "@/lib/order-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Form state
  const [code, setCode] = useState("005930");
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<KROrderResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Bot positions state
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const botsAbortRef = useRef<AbortController | null>(null);

  // Order log state
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);

  // Load order log on mount
  useEffect(() => {
    setOrderLog(getOrderLog());
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    submitAbortRef.current?.abort();
    botsAbortRef.current?.abort();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    const qtyNum = parseInt(qty);
    if (!code.trim() || isNaN(qtyNum) || qtyNum <= 0) {
      setSubmitError("Code and quantity are required.");
      return;
    }
    if (orderType === "LIMIT" && (!price || isNaN(parseFloat(price)))) {
      setSubmitError("Price required for LIMIT order.");
      return;
    }

    submitAbortRef.current?.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setSubmitting(true);
    setSubmitResult(null);
    setSubmitError(null);

    try {
      const req = {
        code: code.trim(),
        side,
        quantity: qtyNum,
        order_type: orderType,
        ...(orderType === "LIMIT" ? { price: parseInt(price) } : {}),
      };
      const result = await placeKROrder(req, ctrl.signal);
      if (submitAbortRef.current !== ctrl) return;
      setSubmitResult(result);
      const updated = addOrderEntry({
        code: code.trim(),
        side,
        qty: qtyNum,
        order_type: orderType,
        ...(orderType === "LIMIT" ? { price: parseInt(price) } : {}),
        order_id: result.order_id,
        status: result.status,
      });
      setOrderLog(updated);
    } catch (e) {
      if (submitAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      if (submitAbortRef.current === ctrl) setSubmitting(false);
    }
  }

  async function handleRefreshBots() {
    botsAbortRef.current?.abort();
    const ctrl = new AbortController();
    botsAbortRef.current = ctrl;
    setBotsLoading(true);
    setBotsError(null);

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

  // Auto-refresh bot positions on mount
  useEffect(() => {
    handleRefreshBots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClearLog() {
    clearOrderLog();
    setOrderLog([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <h1 className="text-xl font-bold mb-6">Live Order Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: KR Order Form ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              KR Manual Order
            </h2>

            <div className="space-y-3">
              {/* Code */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Code</label>
                <input
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                  placeholder="005930"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
              </div>

              {/* Side toggle */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["BUY", "SELL"] as Side[]).map(s => (
                    <button
                      key={s}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        side === s
                          ? s === "BUY"
                            ? "bg-pos text-bg"
                            : "bg-neg text-bg"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setSide(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
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

              {/* Order type toggle */}
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
                  <input
                    type="number"
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                    placeholder="limit price (KRW)"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
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
              {submitResult && (
                <span className="text-sm text-pos font-mono">
                  #{submitResult.order_id} · {submitResult.status}
                </span>
              )}
              {submitError && (
                <span className="text-sm text-neg">{submitError}</span>
              )}
            </div>
          </div>

          {/* Order Log */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">
                Order Log
              </h2>
              {orderLog.length > 0 && (
                <button
                  className="text-xs text-neg hover:underline"
                  onClick={handleClearLog}
                >
                  Clear
                </button>
              )}
            </div>
            {orderLog.length === 0 ? (
              <p className="text-sm text-text-3">No orders placed yet.</p>
            ) : (
              <div className="overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Code</th>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-left font-medium">Order ID</th>
                      <th className="py-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderLog].reverse().map(entry => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono">{entry.code}</td>
                        <td className={`py-1.5 font-medium ${entry.side === "BUY" ? "text-pos" : "text-neg"}`}>
                          {entry.side}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{entry.qty}</td>
                        <td className="py-1.5 text-text-2 font-mono">{entry.order_id}</td>
                        <td className="py-1.5 text-text-2">{entry.status}</td>
                      </tr>
                    ))}
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
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">
                Bot Positions
              </h2>
              <button
                className="bg-accent text-black text-xs font-medium rounded px-3 py-1 disabled:opacity-40"
                onClick={handleRefreshBots}
                disabled={botsLoading}
              >
                {botsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {botsError && (
              <p className="text-sm text-neg mb-2">{botsError}</p>
            )}

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
                      <th className="py-1 text-left font-medium">Position</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-left font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.bot_id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono text-xs">{bot.bot_id}</td>
                        <td className="py-1.5 text-text-2">{bot.instrument_id}</td>
                        <td className="py-1.5">
                          <span className={`text-xs font-medium ${bot.running ? "text-pos" : "text-text-3"}`}>
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
                        <td className="py-1.5 text-text-2 text-xs">{bot.last_signal ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bots.some(b => b.error) && (
              <div className="mt-3 space-y-1">
                {bots.filter(b => b.error).map(b => (
                  <p key={b.bot_id} className="text-xs text-neg">
                    {b.bot_id}: {b.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
