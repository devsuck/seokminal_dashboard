"use client";

import { useEffect, useRef, useState } from "react";
import { placeKROrder, placeUSOrder, placeHLOrder, getQuote, getCryptoBook } from "@/lib/api";
import { isUSMarketOpen } from "@/lib/market-hours";
import { Panel, PanelHeader, Button, SegmentedToggle } from "@/components/ui";

type Venue = "KR" | "US" | "CRYPTO";

// "AAPL.NASDAQ" → US/AAPL, "005930.XKRX" → KR/005930, "BTC.HL" → CRYPTO/BTC
function parseSymbol(sym: string): { venue: Venue; code: string } {
  const [code, suffix] = sym.split(".");
  const venue: Venue = suffix === "XKRX" ? "KR" : suffix === "HL" ? "CRYPTO" : "US";
  return { venue, code };
}

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

const QTY_PRESETS_STOCK = [1, 5, 10, 50, 100];
const QTY_PRESETS_CRYPTO = [0.01, 0.1, 0.5, 1];

export function TradeTab({ symbol }: { symbol: string }) {
  const { venue, code } = parseSymbol(symbol);
  const isCrypto = venue === "CRYPTO";
  const cur = venue === "KR" ? "₩" : "$";
  const qtyPresets = isCrypto ? QTY_PRESETS_CRYPTO : QTY_PRESETS_STOCK;
  const qtyStep = isCrypto ? 0.1 : 1;
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice] = useState("");
  const [paper, setPaper] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live current price (US only — Finnhub). KR: not fetched (needs KIS REST).
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const priceRef = useRef<number | null>(null);

  useEffect(() => {
    setLivePrice(null); setPrevPrice(null); priceRef.current = null;
    if (venue === "KR") return; // KR: needs KIS REST, not fetched
    let cancelled = false;
    let fetchedOnce = false;
    const ctrl = new AbortController();
    async function poll() {
      // 미국 장 마감 + 이미 현재가 있음 → 스킵 (한도 절약). 크립토는 24/7.
      if (venue === "US" && fetchedOnce && !isUSMarketOpen()) return;
      try {
        const p = venue === "CRYPTO"? (await getCryptoBook(code, ctrl.signal)).mid_price
          : (await getQuote(code, ctrl.signal)).price;
        if (cancelled) return;
        fetchedOnce = true;
        setPrevPrice(priceRef.current);
        priceRef.current = p;
        setLivePrice(p);
      } catch { /* ignore; keep last */ }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; ctrl.abort(); clearInterval(id); };
  }, [code, venue]);

  const q = (isCrypto ? parseFloat(qty) : parseInt(qty)) || 0;
  // Effective price for cost estimate: LIMIT → typed price, else live price.
  const estUnit = orderType === "LIMIT" ? (parseFloat(price) || 0) : (livePrice ?? 0);
  const estValue = q > 0 && estUnit > 0 ? q * estUnit : 0;
  const priceUp = livePrice !== null && prevPrice !== null && livePrice >= prevPrice;

  function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: venue === "KR" ? 0 : 2 });
  }

  function stepQty(dir: number) {
    const next = Math.max(qtyStep, q + dir * qtyStep);
    setQty(String(isCrypto ? Number(next.toFixed(4)) : Math.round(next)));
  }

  function request() {
    setError(null); setResult(null);
    if (!q || q <= 0) { setError("수량 > 0"); return; }
    if (orderType === "LIMIT" && (!price || isNaN(parseFloat(price)))) { setError("지정가 입력"); return; }
    setConfirm(true);
  }

  async function submit() {
    setConfirm(false); setSubmitting(true); setError(null);
    try {
      if (venue === "CRYPTO") {
        const r = await placeHLOrder({
          coin: code, is_buy: side === "BUY", size: q,
          order_type: orderType === "LIMIT" ? "limit" : "market", paper,
          ...(orderType === "LIMIT" ? { limit_px: parseFloat(price) } : {}),
        });
        setResult(`HL · ${r.status}${r.paper ? " (테스트넷)" : " (메인넷)"}`);
      } else if (venue === "KR") {
        const r = await placeKROrder({
          code, side, quantity: q, order_type: orderType, paper,
          ...(orderType === "LIMIT" ? { price: parseInt(price) } : {}),
        });
        setResult(`#${r.order_id} · ${r.status}`);
      } else {
        const r = await placeUSOrder({
          symbol: code, side, quantity: q, order_type: orderType, paper,
          ...(orderType === "LIMIT" ? { limit_price: parseFloat(price) } : {}),
        });
        setResult(`#${r.order_id} · ${r.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-md">
      <Panel>
        <PanelHeader>{code} 매매</PanelHeader>
        <div className="p-3 space-y-3">
          {/* Live price + venue/account badge */}
          <div className="flex items-center gap-2">
            {livePrice !== null && (
              <span className={`text-sm font-data ${priceUp ? "text-pos" : "text-neg"}`}>{cur}{fmt(livePrice)}</span>
            )}
            <div className="text-[10px] px-1.5 py-0.5 bg-panel-2 border border-border text-text-3">
              {venue === "CRYPTO"? (paper ? "크립토 · HL 테스트넷" : "크립토 · HL 메인넷")
                : venue === "KR"? (paper ? "한국 · KIS 모의" : "한국 · KIS 실계좌")
                : (paper ? "미국 · Alpaca 페이퍼" : "미국 · IB 실계좌")}
            </div>
          </div>

          {/* Account: paper / live */}
          <SegmentedToggle
            value={paper}
            onChange={setPaper}
            options={[
              { value: true, label: isCrypto ? "테스트넷" : "모의", activeClass: "border-pos text-pos bg-pos/10" },
              { value: false, label: isCrypto ? "메인넷" : "실계좌", activeClass: "border-neg text-neg bg-neg/10" },
            ]}
          />

          {/* Side: buy / sell */}
          <SegmentedToggle
            value={side}
            onChange={setSide}
            size="md"
            options={[
              { value: "BUY", label: "매수", activeClass: "border-pos text-pos bg-pos/10" },
              { value: "SELL", label: "매도", activeClass: "border-neg text-neg bg-neg/10" },
            ]}
          />

          {/* Order type */}
          <SegmentedToggle
            value={orderType}
            onChange={setOrderType}
            size="sm"
            options={[
              { value: "MARKET", label: "시장가" },
              { value: "LIMIT", label: "지정가" },
            ]}
          />

          {/* Quantity: stepper + input */}
          <div>
            <label className="text-text-3 text-xs">수량</label>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => stepQty(-1)} className="w-8 h-8 shrink-0 !px-0">−</Button>
              <input value={qty} onChange={e => setQty(e.target.value.replace(isCrypto ? /[^0-9.]/g : /[^0-9]/g, ""))} inputMode={isCrypto ? "decimal" : "numeric"}
                className="flex-1 min-w-0 bg-panel-2 border border-border px-2.5 py-1.5 text-text-1 text-sm font-data text-center outline-none focus:border-accent" />
              <Button variant="outline" size="sm" onClick={() => stepQty(1)} className="w-8 h-8 shrink-0 !px-0">+</Button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {qtyPresets.map(p => (
                <button key={p} onClick={() => setQty(String(p))}
                  className={`flex-1 text-[11px] py-1 border font-data ${q === p ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Limit price */}
          {orderType === "LIMIT" && (
            <div>
              <label className="text-text-3 text-xs">지정가 ({cur})</label>
              <div className="flex items-center gap-2 mt-1">
                <input value={price} onChange={e => setPrice(e.target.value)} placeholder={`지정가 (${cur})`}
                  className="flex-1 min-w-0 bg-panel-2 border border-border px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
                {livePrice !== null && (
                  <Button variant="ghost" size="sm" onClick={() => setPrice(String(livePrice))} className="shrink-0 border-border hover:text-accent hover:border-accent">
                    현재가
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Estimated order value */}
          <div className="flex justify-between items-center px-1 text-sm">
            <span className="text-text-3 text-xs">예상 주문금액</span>
            <span className="font-data text-text-1">{estValue > 0 ? `${cur}${fmt(estValue)}` : "—"}</span>
          </div>

          <Button variant={side === "BUY" ? "buy" : "sell"} onClick={request} disabled={submitting} className="w-full">
            {submitting ? "주문 중…" : `${side === "BUY" ? "매수" : "매도"} 주문`}
          </Button>
          {result && <p className="text-pos text-sm font-mono">{result}</p>}
          {error && <p className="text-neg text-sm">{error}</p>}
        </div>
      </Panel>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Panel className="w-[320px]">
            <PanelHeader>주문 확인</PanelHeader>
            <div className="p-4 space-y-3">
              <div className="text-sm font-data text-text-2 space-y-1">
                <div className="flex justify-between"><span className="text-text-3">종목</span><span>{code} ({venue})</span></div>
                <div className="flex justify-between"><span className="text-text-3">계좌</span><span>{paper ? "모의" : "실계좌"}</span></div>
                <div className="flex justify-between"><span className="text-text-3">구분</span><span className={side === "BUY" ? "text-pos" : "text-neg"}>{side === "BUY" ? "매수" : "매도"}</span></div>
                <div className="flex justify-between"><span className="text-text-3">수량</span><span>{qty}</span></div>
                <div className="flex justify-between"><span className="text-text-3">유형</span><span>{orderType === "LIMIT" ? `지정가 ${cur}${price}` : "시장가"}</span></div>
                {estValue > 0 && (
                  <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-text-3">예상금액</span><span className="text-text-1">{cur}{fmt(estValue)}</span></div>
                )}
              </div>
              {!paper && (
                <p className="text-warn text-xs">⚠ 실계좌 주문 — 실제 체결됩니다.</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>취소</Button>
                <Button variant="primary" size="sm" onClick={submit}>확인·주문</Button>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
