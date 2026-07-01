"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getCopySignals, getCopyPositions, mirrorCopyTrade,
  type CopySignal, type CopyPosition,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";

const MIRRORED_KEY = "copytrade-mirrored";   // 이미 미러한 신호 키 집합 (자동추종 중복 방지)
const AUTO_KEY = "copytrade-auto";
const NOTIONAL_KEY = "copytrade-notional";

function sigKey(s: CopySignal): string {
  return `${s.source}:${s.name}:${s.ticker}:${s.date}`;
}

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
}

export default function CopyTradePage() {
  const [signals, setSignals] = useState<CopySignal[]>([]);
  const [positions, setPositions] = useState<CopyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notional, setNotional] = useState("500");
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sigCtrl = useRef<AbortController | null>(null);
  const posCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setAuto(localStorage.getItem(AUTO_KEY) === "1");
    const n = localStorage.getItem(NOTIONAL_KEY); if (n) setNotional(n);
  }, []);

  const loadPositions = useCallback(() => {
    posCtrl.current?.abort();
    const ctrl = new AbortController(); posCtrl.current = ctrl;
    getCopyPositions(ctrl.signal)
      .then(p => { if (!ctrl.signal.aborted) setPositions(p); })
      .catch(() => { /* paper 계좌 없으면 무시 */ });
  }, []);

  async function mirror(s: CopySignal, silent = false) {
    const amt = parseFloat(notional) || 500;
    if (!silent) setBusy(sigKey(s));
    try {
      await mirrorCopyTrade(s.ticker, amt);
      const set = loadSet(MIRRORED_KEY); set.add(sigKey(s));
      localStorage.setItem(MIRRORED_KEY, JSON.stringify([...set]));
      if (!silent) { setToast(`페이퍼 미러: ${s.ticker} $${amt}`); setTimeout(() => setToast(null), 2500); }
      loadPositions();
    } catch (e) {
      if (!silent) { setToast(`실패: ${e instanceof ApiError ? e.message : String(e)}`); setTimeout(() => setToast(null), 3500); }
    } finally {
      if (!silent) setBusy(null);
    }
  }

  const loadSignals = useCallback(() => {
    sigCtrl.current?.abort();
    const ctrl = new AbortController(); sigCtrl.current = ctrl;
    setError(null);
    getCopySignals(60, ctrl.signal)
      .then(async data => {
        if (ctrl.signal.aborted) return;
        setSignals(data); setLoading(false);
        // 자동추종: 아직 안 미러한 신호를 페이퍼로 (사이클당 최대 5건, 폭주 방지)
        if (localStorage.getItem(AUTO_KEY) === "1") {
          const done = loadSet(MIRRORED_KEY);
          const fresh = data.filter(s => !done.has(sigKey(s))).slice(0, 5);
          for (const s of fresh) await mirror(s, true);
        }
      })
      .catch(e => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof ApiError ? e.message : String(e)); setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notional]);

  useEffect(() => {
    loadSignals(); loadPositions();
    const iv = setInterval(() => { loadSignals(); loadPositions(); }, 60_000);
    return () => { clearInterval(iv); sigCtrl.current?.abort(); posCtrl.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto() {
    const next = !auto; setAuto(next);
    localStorage.setItem(AUTO_KEY, next ? "1" : "0");
  }

  const totalPl = positions.reduce((a, p) => a + p.unrealized_pl, 0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">카피트레이드 오토파일럿</h1>
        <p className="text-text-3 text-sm mt-0.5">
          의회·내부자 <span className="text-text-2">공개 매수 신고</span>를 페이퍼 계좌에 미러링. AI 예측 아님 — 스마트머니 추종(규칙 기반). 공시 지연 있으니 엣지는 제한적, <span className="text-warn">검증용 페이퍼</span>.
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3 flex-wrap">
        <label className="text-text-3 text-xs">미러 금액</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">$</span>
          <input value={notional}
            onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ""); setNotional(v); localStorage.setItem(NOTIONAL_KEY, v); }}
            inputMode="decimal"
            className="w-28 bg-panel-2 border border-border rounded pl-6 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        </div>
        <button onClick={toggleAuto}
          className={`text-xs px-3 py-1.5 rounded border ${auto ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
          {auto ? "● 자동 추종 ON (페이퍼)" : "자동 추종 OFF"}
        </button>
        <span className="text-text-3 text-[11px]">신규 매수 신고 자동 미러 (사이클당 최대 5건)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* 신호 */}
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">매수 신호 (의회·내부자)</span>
            <span className="text-text-3 text-[11px]">{signals.length}건 · 1분 갱신</span>
          </div>
          {error ? <div className="p-2"><EmptyState message="신호 로드 실패" hint={error} /></div>
            : loading ? <LoadingState message="신호 로딩 중…" />
            : signals.length === 0 ? <EmptyState message="매수 신호 없음" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border">
                    <th className="text-left font-medium px-3 py-2">소스</th>
                    <th className="text-left font-medium px-3 py-2">이름</th>
                    <th className="text-left font-medium px-3 py-2">종목</th>
                    <th className="text-left font-medium px-3 py-2">거래일</th>
                    <th className="text-right font-medium px-3 py-2">금액</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => {
                    const k = sigKey(s);
                    return (
                      <tr key={k} className="border-b border-border/50 hover:bg-panel-2">
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.source === "congress" ? "text-info border-info/40 bg-info/10" : "text-accent border-accent/40 bg-accent/10"}`}>
                            {s.source === "congress" ? "🏛 의회" : "👤 내부자"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-2 truncate max-w-[140px]">{s.name}</td>
                        <td className="px-3 py-2 font-data text-text-1 font-semibold">{s.ticker}</td>
                        <td className="px-3 py-2 text-text-3 font-data text-xs">{s.date}</td>
                        <td className="px-3 py-2 text-right text-text-3 text-xs">{s.amount ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => mirror(s)} disabled={busy === k}
                            className="text-[11px] px-2 py-1 rounded border border-pos/40 text-pos hover:bg-pos/10 disabled:opacity-40">
                            {busy === k ? "…" : "미러 매수"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>

        {/* 미러 포지션 */}
        <div className="bg-panel border border-border rounded-lg overflow-hidden h-fit">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">페이퍼 보유</span>
            <span className={`text-xs font-data ${totalPl >= 0 ? "text-pos" : "text-neg"}`}>
              {totalPl >= 0 ? "+" : ""}${totalPl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          {positions.length === 0 ? (
            <div className="p-6"><EmptyState message="보유 없음" hint="신호를 미러하면 여기 표시" /></div>
          ) : (
            <div className="divide-y divide-border/50">
              {positions.map(p => (
                <div key={p.ticker} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-data text-text-1 text-sm font-semibold">{p.ticker}</div>
                    <div className="text-text-3 text-[10px] font-data">{p.qty.toFixed(4)}주 · 평단 ${p.avg_price.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-data text-sm ${p.unrealized_pl >= 0 ? "text-pos" : "text-neg"}`}>
                      {p.unrealized_pl >= 0 ? "+" : ""}${p.unrealized_pl.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-data ${p.unrealized_plpc >= 0 ? "text-pos" : "text-neg"}`}>
                      {p.unrealized_plpc >= 0 ? "+" : ""}{p.unrealized_plpc.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-text-1 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
