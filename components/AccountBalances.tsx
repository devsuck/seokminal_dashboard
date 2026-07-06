"use client";

import type { AccountBalances, AccountRow } from "@/lib/api";

function money(n: number, ccy: string): string {
  const sym = ccy === "KRW" ? "₩" : ccy === "USDC" ? "" : ccy === "EUR" ? "€" : "$";
  const suffix = ccy === "USDC" ? " USDC" : "";
  return `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: ccy === "KRW" ? 0 : 2 })}${suffix}`;
}

export function BalanceCard({ acc }: { acc: AccountRow }) {
  const remaining = acc.balance != null ? acc.balance - acc.allocated : null;
  const over = remaining != null && remaining < 0;
  return (
    <div className="bg-panel border border-border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-text-2 text-xs font-semibold">{acc.label}</span>
        {acc.mode && <span className={`text-[9px] px-1.5 py-0.5 rounded border ${acc.mode === "live" ? "bg-neg/15 text-neg border-neg/40" : "bg-pos/10 text-pos border-pos/30"}`}>{acc.mode === "live" ? "● LIVE" : "PAPER"}</span>}
      </div>
      {acc.error ? (
        <div className="text-text-3 text-[10px] mt-1.5">연결 불가 ({acc.error.slice(0, 30)})</div>
      ) : (
        <>
          <div className="text-base font-data text-text-1 mt-1 truncate">{acc.balance != null ? money(acc.balance, acc.ccy) : "—"}</div>
          <div className="flex flex-col gap-0.5 text-[10px] font-data mt-1.5">
            <span className="text-text-3">배정 {money(acc.allocated, acc.ccy)}</span>
            <span className={over ? "text-neg" : "text-text-2"}>
              잔여 {remaining != null ? money(remaining, acc.ccy) : "—"}{over && " ⚠초과"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function Balances({ bal }: { bal: AccountBalances }) {
  return (
    <div className="space-y-2">
      <p className="text-text-3 text-[10px] uppercase tracking-wider">계좌 잔액 & 배정 (배정 정할 때 참고)</p>
      <div className="grid grid-cols-2 gap-2">
        {bal.accounts.map(a => <BalanceCard key={a.venue} acc={a} />)}
      </div>
    </div>
  );
}
