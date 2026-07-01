"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError, getDartSignals, getDartPositions, mirrorDart,
  type DartSignal, type DartPosition,
} from "@/lib/api";
import { EmptyState, LoadingState } from "@/components/ui";

const MIRRORED_KEY = "dart-mirrored";
const AUTO_KEY = "dart-auto";
const KRW_KEY = "dart-krw";

function sigKey(s: DartSignal): string {
  return `${s.corp_name}:${s.action_type}:${s.date}`;
}
function loadSet(k: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set(); }
}

const VERDICT: Record<string, string> = {
  BUY: "text-pos border-pos/40 bg-pos/10",
  AVOID: "text-neg border-neg/40 bg-neg/10",
  SKIP: "text-text-3 border-border bg-panel-2",
};

export default function DartAutoPage() {
  const [signals, setSignals] = useState<DartSignal[]>([]);
  const [positions, setPositions] = useState<DartPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [krw, setKrw] = useState("1000000");
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sCtrl = useRef<AbortController | null>(null);
  const pCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    setAuto(localStorage.getItem(AUTO_KEY) === "1");
    const v = localStorage.getItem(KRW_KEY); if (v) setKrw(v);
  }, []);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 2800); }

  const loadPositions = useCallback(() => {
    pCtrl.current?.abort();
    const ctrl = new AbortController(); pCtrl.current = ctrl;
    getDartPositions(ctrl.signal).then(p => { if (!ctrl.signal.aborted) setPositions(p); }).catch(() => {});
  }, []);

  async function buy(s: DartSignal, silent = false) {
    if (!s.ticker) { if (!silent) flash("종목코드 없음"); return; }
    const amt = parseFloat(krw) || 1000000;
    if (!silent) setBusy(sigKey(s));
    try {
      const r = await mirrorDart(s.ticker, amt);
      const set = loadSet(MIRRORED_KEY); set.add(sigKey(s));
      localStorage.setItem(MIRRORED_KEY, JSON.stringify([...set]));
      if (!silent) flash(`${s.corp_name} ${r.qty}주 모의 매수 (₩${r.price.toLocaleString()})`);
      loadPositions();
    } catch (e) {
      if (!silent) flash(`실패: ${e instanceof ApiError ? e.message : String(e)}`);
    } finally {
      if (!silent) setBusy(null);
    }
  }

  const loadSignals = useCallback(() => {
    sCtrl.current?.abort();
    const ctrl = new AbortController(); sCtrl.current = ctrl;
    setError(null);
    getDartSignals(14, ctrl.signal)
      .then(async d => {
        if (ctrl.signal.aborted) return;
        setSignals(d); setLoading(false);
        // 자동추종: 신규 BUY(자사주 취득/소각)만 모의 매수 (사이클당 최대 5건)
        if (localStorage.getItem(AUTO_KEY) === "1") {
          const done = loadSet(MIRRORED_KEY);
          const fresh = d.filter(s => s.verdict === "BUY" && s.ticker && !done.has(sigKey(s))).slice(0, 5);
          for (const s of fresh) await buy(s, true);
        }
      })
      .catch(e => { if (!ctrl.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [krw]);

  useEffect(() => {
    loadSignals(); loadPositions();
    const iv = setInterval(() => { loadSignals(); loadPositions(); }, 60_000);
    return () => { clearInterval(iv); sCtrl.current?.abort(); pCtrl.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto() { const n = !auto; setAuto(n); localStorage.setItem(AUTO_KEY, n ? "1" : "0"); }

  const totalPl = positions.reduce((a, p) => a + (p.current - p.avg_price) * p.qty, 0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">DART 기업행위 오토파일럿</h1>
        <p className="text-text-3 text-sm mt-0.5">
          한국 공시 실시간 감시 → <span className="text-pos">자사주 취득·소각(호재)=매수</span>, <span className="text-neg">유상증자(악재)=회피</span>. 개인 내부자 매매는 5영업일 지연이라 제외. <span className="text-warn">KIS 모의(페이퍼)</span>. 장외 공시가 그나마 개인에 유리(장중은 알고와 경쟁).
        </p>
      </div>

      <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3 flex-wrap">
        <label className="text-text-3 text-xs">매수 예산</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm font-data">₩</span>
          <input value={krw}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); setKrw(v); localStorage.setItem(KRW_KEY, v); }}
            inputMode="numeric"
            className="w-36 bg-panel-2 border border-border rounded pl-7 pr-2.5 py-1.5 text-text-1 text-sm font-data outline-none focus:border-accent" />
        </div>
        <button onClick={toggleAuto}
          className={`text-xs px-3 py-1.5 rounded border ${auto ? "border-pos text-pos bg-pos/10" : "border-border text-text-3 hover:text-text-2"}`}>
          {auto ? "● 자동 매수 ON (모의)" : "자동 매수 OFF"}
        </button>
        <span className="text-text-3 text-[11px]">신규 자사주 취득/소각 공시 자동 모의매수 (사이클당 최대 5건)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">기업행위 공시 (최근 14일)</span>
            <span className="text-text-3 text-[11px]">{signals.length}건 · 1분 갱신</span>
          </div>
          {error ? <div className="p-2"><EmptyState message="공시 로드 실패" hint={error} /></div>
            : loading ? <LoadingState message="DART 공시 로딩 중…" />
            : signals.length === 0 ? <EmptyState message="기업행위 공시 없음" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-3 text-[11px] border-b border-border">
                    <th className="text-left font-medium px-3 py-2">기업</th>
                    <th className="text-left font-medium px-3 py-2">종목</th>
                    <th className="text-left font-medium px-3 py-2">공시</th>
                    <th className="text-left font-medium px-3 py-2">판정</th>
                    <th className="text-left font-medium px-3 py-2">접수일</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => {
                    const k = sigKey(s);
                    return (
                      <tr key={k} className="border-b border-border/50 hover:bg-panel-2">
                        <td className="px-3 py-2 text-text-2 truncate max-w-[120px]">{s.corp_name}</td>
                        <td className="px-3 py-2 font-data text-text-1">{s.ticker ?? "—"}</td>
                        <td className="px-3 py-2 text-text-3 text-xs">{s.action_label}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${VERDICT[s.verdict]}`}>
                            {s.verdict === "BUY" ? "매수" : s.verdict === "AVOID" ? "회피" : "중립"} · {s.note}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-3 font-data text-xs">{s.date}</td>
                        <td className="px-3 py-2 text-right">
                          {s.verdict === "BUY" && s.ticker ? (
                            <button onClick={() => buy(s)} disabled={busy === k}
                              className="text-[11px] px-2 py-1 rounded border border-pos/40 text-pos hover:bg-pos/10 disabled:opacity-40">
                              {busy === k ? "…" : "모의 매수"}
                            </button>
                          ) : s.dart_url ? (
                            <a href={s.dart_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-text-3 hover:text-accent no-underline">DART ↗</a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>

        <div className="bg-panel border border-border rounded-lg overflow-hidden h-fit">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
            <span className="text-text-2 text-xs uppercase tracking-wider font-semibold">모의 보유 (KIS)</span>
            <span className={`text-xs font-data ${totalPl >= 0 ? "text-pos" : "text-neg"}`}>
              {totalPl >= 0 ? "+" : ""}₩{Math.round(totalPl).toLocaleString()}
            </span>
          </div>
          {positions.length === 0 ? (
            <div className="p-6"><EmptyState message="보유 없음" hint="공시를 매수하면 여기 표시" /></div>
          ) : (
            <div className="divide-y divide-border/50">
              {positions.map(p => (
                <div key={p.code} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-data text-text-1 text-sm font-semibold">{p.code}</div>
                    <div className="text-text-3 text-[10px] font-data">{p.qty}주 · 평단 ₩{p.avg_price.toLocaleString()}</div>
                  </div>
                  <div className={`text-right font-data text-sm ${(p.return_pct ?? 0) >= 0 ? "text-pos" : "text-neg"}`}>
                    {p.return_pct != null ? `${p.return_pct >= 0 ? "+" : ""}${p.return_pct.toFixed(2)}%` : "—"}
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
