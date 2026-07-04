"use client";

import { useState } from "react";
import Link from "next/link";
import { getAiRecommendation, type AiRecommendation } from "@/lib/api";
import { JarvisOrb, ThinkingLine } from "@/components/Jarvis";

/* 자유형 AI 에이전트 (v1 스캐폴드).
   자연어 mandate → advisor 분석 + 레드팀이 요구할 통제 + 파이프 연결.
   ⚠️ 완전 자유형 LLM 추론(멀티스텝 자율)은 Claude API 예산 필요 = 다음 레이어. */

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

// 레드팀 통제 요구(전략 특성별) — 백엔드 controls.py와 같은 논리, UI 참고용
function requiredControls(mandate: string): string[] {
  const m = mandate.toLowerCase();
  const req = ["매칭 random 이기나", "walk-forward(전후반 안정)", "극단 비용 스트레스"];
  if (/저점|고점|dip|bottom|extreme|sweep/.test(m)) req.push("극단진입 confound 통제(딥매수 착시)");
  if (/스윙|swing|fractal|프랙탈|인트라데이|분봉/.test(m)) req.push("lookahead(미래봉 참조) 확인");
  if (/무상증자|분할|권리|배당락/.test(m)) req.push("권리락 수정주가");
  if (/여러|모델|변형|파라미터|스캔/.test(m)) req.push("다중검정 BH-FDR");
  if (/kr|한국|코스닥|코스피|소형주|이벤트|공시/.test(m)) req.push("survivorship(폐지종목 포함)");
  return req;
}

export default function FreeformAgentPage() {
  const [mandate, setMandate] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rec, setRec] = useState<AiRecommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    if (!symbol.trim()) { setErr("종목(instrument_id) 입력 — 예: 005930.XKRX, AAPL.ARCA"); return; }
    setBusy(true); setErr(null); setRec(null);
    try {
      const end = new Date(); const start = new Date(); start.setFullYear(end.getFullYear() - 1);
      const r = await getAiRecommendation(symbol.trim(), ymd(start), ymd(end));
      setRec(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const controls = mandate.trim() ? requiredControls(mandate) : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="hud-frame tech-grid scanline-host flex items-center gap-4 bg-panel border border-border rounded-lg p-4">
        <JarvisOrb size={56} active={busy} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text-1 tracking-wide">자유형 AI 에이전트</h1>
          <div className="mt-1 h-4">
            {busy
              ? <ThinkingLine text="종목 분석 중… advisor 실행" />
              : <p className="text-text-3 text-sm">자연어 아이디어 → 분석 + 레드팀 통제 + 검증 파이프 연결. v1 스캐폴드.</p>}
          </div>
        </div>
      </div>

      {/* mandate */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div>
          <label className="text-xs text-text-3">아이디어 / Mandate (자연어)</label>
          <textarea value={mandate} onChange={e => setMandate(e.target.value)} rows={3}
            placeholder="예: 자사주 매입 공시난 소형주를 다음날 사서 20일 보유. 하락장일 때만."
            className="w-full mt-1 bg-panel-2 border border-border rounded px-3 py-2 text-sm text-text-1 resize-none" />
        </div>
        <div className="flex gap-2">
          <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="종목 instrument_id (분석용)"
            className="flex-1 bg-panel-2 border border-border rounded px-3 py-2 text-sm text-text-1 font-data" />
          <button onClick={analyze} disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded bg-accent text-black disabled:opacity-40 cursor-pointer border-0">
            {busy ? "분석중…" : "분석"}
          </button>
        </div>
        {err && <div className="text-xs text-neg">{err}</div>}
      </div>

      {/* 레드팀 통제 요구 */}
      {controls.length > 0 && (
        <div className="bg-panel border border-info/30 rounded-lg p-4">
          <div className="text-sm font-semibold text-text-1 mb-2">레드팀이 요구할 통제</div>
          <p className="text-[11px] text-text-3 mb-2">이 아이디어를 믿기 전에 결정적 코드가 이 통제를 통과해야 함(합의된 노이즈 방지).</p>
          <div className="space-y-1">
            {controls.map(c => (
              <div key={c} className="flex items-center gap-2 text-xs">
                <span className="text-info">›</span><span className="text-text-2">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* advisor 분석 결과 */}
      {rec && (
        <div className="bg-panel border border-pos/30 rounded-lg p-4 space-y-2">
          <div className="text-sm font-semibold text-text-1">분석 결과 ({rec.instrument_id})</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-1.5 py-0.5 rounded border border-accent/40 text-accent">전략: {rec.strategy}</span>
            {Object.entries(rec.params).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 rounded border border-border text-text-3 font-data">{k}={v}</span>
            ))}
          </div>
          <p className="text-[13px] text-text-2 leading-relaxed">{rec.reasoning}</p>
          <Link href={`/backtest?instrument_id=${encodeURIComponent(rec.instrument_id)}&strategy=${rec.strategy}`}
            className="inline-block text-xs text-accent border border-accent/30 rounded px-2.5 py-1 no-underline hover:bg-accent/10">
            백테스트로 검증 →
          </Link>
        </div>
      )}

      {/* 파이프 연결 + 정직 */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-2">
        <div className="text-sm font-semibold text-text-1">검증 파이프 (아이디어 → 실전)</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-3">
          {["자유형 아이디어", "레드팀 통제", "실데이터 백테스트", "BH-FDR", "페이퍼", "사람 게이트 → live"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="px-2 py-1 rounded border border-border text-text-2">{s}</span>
              {i < arr.length - 1 && <span className="text-text-3">→</span>}
            </span>
          ))}
        </div>
        <div className="text-[11px] text-warn border-t border-border pt-2 mt-2">
          ⚠️ v1 스캐폴드. 완전 자유형 LLM 추론(멀티스텝 자율 연구)은 Claude API 예산 필요 = 다음 레이어.
          지금은 advisor 분석 + 통제 요구까지. 판정은 결정적 하네스가(LLM 합의 아님).
        </div>
        <div className="flex gap-2 pt-1">
          <Link href="/lab" className="text-xs text-accent no-underline hover:underline">AI LAB →</Link>
          <Link href="/validation" className="text-xs text-accent no-underline hover:underline">검증 터미널 →</Link>
        </div>
      </div>
    </div>
  );
}
