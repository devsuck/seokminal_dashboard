"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBars, getKRBars, getCryptoBook } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  getPriceAlerts, addPriceAlert, removePriceAlert, markTriggered, type PriceAlert,
} from "@/lib/price-alert-storage";
import { Button, SegmentedToggle } from "@/components/ui";

function suffixOf(sym: string) { return sym.split(".")[1]; }

async function latestPrice(symbol: string): Promise<number | null> {
  try {
    const suffix = suffixOf(symbol);
    if (suffix === "HL") {
      const b = await getCryptoBook(symbol.split(".")[0]);
      return b.mid_price > 0 ? b.mid_price : null;
    }
    if (suffix === "XKRX") {
      const r = await getKRBars(symbol.split(".")[0], 5);
      const b = r.bars?.[r.bars.length - 1];
      return b ? b.close : null;
    }
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const r = await getBars(symbol, start, end);
    const b = r.bars?.[r.bars.length - 1];
    return b ? b.close : null;
  } catch {
    return null;
  }
}

export function AlertTab({ symbol }: { symbol: string }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => setAlerts(getPriceAlerts()), []);
  useEffect(() => { refresh(); }, [refresh]);

  // Poll latest price for symbols with untriggered alerts → toast on cross.
  useEffect(() => {
    let live = true;
    async function poll() {
      const active = getPriceAlerts().filter(a => !a.triggered);
      const syms = [...new Set(active.map(a => a.symbol))];
      for (const s of syms) {
        const p = await latestPrice(s);
        if (p == null) continue;
        for (const a of active.filter(x => x.symbol === s)) {
          const hit = a.direction === "above" ? p >= a.price : p <= a.price;
          if (hit) {
            toast.show(` ${a.symbol} ${a.direction === "above" ? "≥" : "≤"} ${a.price} (현재 ${p})`, "warn", 8000);
            markTriggered(a.id);
          }
        }
      }
      if (live) { refresh(); pollRef.current = setTimeout(poll, 30000); }
    }
    pollRef.current = setTimeout(poll, 2000);
    return () => { live = false; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [refresh]);

  function add() {
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    setAlerts(addPriceAlert(symbol, direction, p));
    setPrice("");
  }

  const forSymbol = alerts.filter(a => a.symbol === symbol);
  const others = alerts.filter(a => a.symbol !== symbol);

  return (
    <div className="p-4 max-w-md space-y-3">
      <div className="text-text-2 text-sm font-semibold">{symbol} 가격 알림</div>
      <SegmentedToggle
        value={direction}
        onChange={setDirection}
        size="md"
        options={[
          { value: "above", label: "이상 ≥" },
          { value: "below", label: "이하 ≤" },
        ]}
      />
      <div className="flex gap-2">
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="목표 가격"className="flex-1 bg-panel-2 border border-border rounded px-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        <Button variant="primary" size="md" onClick={add}>추가</Button>
      </div>

      {forSymbol.length > 0 && (
        <div className="space-y-1">
          <p className="text-text-3 text-[10px] uppercase tracking-wider">이 종목</p>
          {forSymbol.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-panel-2 border border-border rounded px-2.5 py-1.5 text-xs">
              <span className="font-data">{a.direction === "above" ? "≥" : "≤"} {a.price} {a.triggered && <span className="text-warn">· 발동됨</span>}</span>
              <button onClick={() => setAlerts(removePriceAlert(a.id))} className="text-text-3 hover:text-neg text-[10px]">삭제</button>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-1">
          <p className="text-text-3 text-[10px] uppercase tracking-wider">다른 종목 ({others.length})</p>
          {others.map(a => (
            <div key={a.id} className="flex items-center justify-between text-[11px] text-text-3 px-2.5 py-1">
              <span className="font-data">{a.symbol} {a.direction === "above" ? "≥" : "≤"} {a.price}{a.triggered && " ·발동"}</span>
              <button onClick={() => setAlerts(removePriceAlert(a.id))} className="hover:text-neg text-[10px]">삭제</button>
            </div>
          ))}
        </div>
      )}
      <p className="text-text-3 text-[10px]">시장 페이지 열려있는 동안 30초마다 확인 → 토스트 알림.</p>
    </div>
  );
}
