"use client";

import { useEffect, useRef, useState } from "react";
import { getLabStatus, toggleResearchService, type LabStatus } from "@/lib/api";

function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

function Dot({ on, warn }: { on: boolean; warn?: boolean }) {
  const c = on ? (warn ? "text-warn" : "text-pos") : "text-neg";
  return (
    <span className={`relative flex h-3 w-3 ${c}`}>
      {on && <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />}
      <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
    </span>
  );
}

export default function StatusPage() {
  const [st, setSt] = useState<LabStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function tick() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const d = await getLabStatus(ctrl.signal);
        if (mounted && !ctrl.signal.aborted) { setSt(d); setErr(null); }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (mounted) setErr(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    const iv = setInterval(tick, 5000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  const dart = st?.dart_bot;
  const ai = st?.ai_lab;
  const svc = st?.research_service;

  async function onToggleSvc() {
    try { await toggleResearchService(!(svc?.enabled ?? false)); } catch { /* 폴링이 반영 */ }
  }

  return (
    <div className="min-h-screen bg-bg p-4 max-w-md mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-1">봇 상태 보드</h1>
        <span className="text-[11px] text-text-3 font-data">{st ? ago(st.now) + " 갱신" : "…"}</span>
      </div>

      {err && <div className="text-xs text-neg border border-neg/30 rounded px-3 py-2">서버 연결 안됨: {err}</div>}

      {/* 서버 */}
      <Card>
        <Row><Dot on={st?.server === "ok"} /><b className="text-text-1">API 서버</b>
          <span className="ml-auto text-xs text-text-2">{st?.server === "ok" ? "실행중" : "다운"}</span></Row>
      </Card>

      {/* DART 봇 */}
      <Card>
        <Row><Dot on={!!dart?.running} warn={dart?.running && !dart?.enabled} />
          <b className="text-text-1">DART 자동봇</b>
          <span className="ml-auto text-xs text-text-2">
            {!dart?.running ? "다운" : dart.enabled ? "가동(매매ON)" : "가동(관찰만)"}
          </span></Row>
        {dart?.running && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Kv k="마지막 스캔" v={ago(dart.last_run)} />
            <Kv k="주기" v={dart.interval_sec ? `${dart.interval_sec}s` : "—"} />
            <Kv k="실행한 매매" v={String(dart.acted ?? 0)} />
            <Kv k="최근 이벤트" v={String(dart.recent?.length ?? 0)} />
          </div>
        )}
      </Card>

      {/* AI LAB */}
      <Card>
        <Row><Dot on={!!ai && !ai.error} warn={ai?.continuous_loop === "stopped_manual"} />
          <b className="text-text-1">AI LAB / Jarvis</b>
          <span className="ml-auto text-xs text-text-2">{ai?.busy ? "검토중" : ai?.engine_status ?? "—"}</span></Row>
        {ai && !ai.error && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Kv k="연속 루프" v={ai.continuous_loop === "stopped_manual" ? "정지(수동)" : ai.continuous_loop ?? "—"} warn={ai.continuous_loop === "stopped_manual"} />
            <Kv k="자율 레벨" v={`Lv ${ai.autonomy_level ?? "—"}`} />
            <Kv k="검토 누적" v={String(ai.processed ?? 0)} />
            <Kv k="live 실행" v={ai.live_execution ?? "—"} warn={ai.live_execution !== "disabled"} />
          </div>
        )}
      </Card>

      {/* 서버사이드 리서치 서비스 (D) */}
      <Card>
        <Row>
          <Dot on={!!svc?.running} warn={svc?.running && !svc?.enabled} />
          <b className="text-text-1">리서치 서비스</b>
          <button
            onClick={onToggleSvc}
            className={`ml-auto px-2.5 py-1 text-xs font-medium rounded border cursor-pointer transition-colors ${
              svc?.enabled ? "border-pos/50 text-pos bg-pos/10" : "border-border text-text-3 bg-transparent"}`}
          >
            {svc?.enabled ? "ON" : "OFF"}
          </button>
        </Row>
        {svc && !svc.error && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Kv k="상태" v={svc.running ? (svc.enabled ? "가동중" : "대기(OFF)") : "정지"} warn={!svc.running || !svc.enabled} />
            <Kv k="주기" v={svc.interval_sec ? `${svc.interval_sec}s` : "—"} />
            <Kv k="마지막 틱" v={ago(svc.last_run)} />
            <Kv k="검증 누적" v={String(svc.processed_total ?? 0)} />
          </div>
        )}
        <div className="mt-1 text-[10px] text-text-3">서버사이드·$0·live 불가. 아이디어는 대화로.</div>
      </Card>

      {/* 감시견 — 돈길 상태 변화(폰에서 이거만 봐도 됨) */}
      <Card>
        <Row>
          <Dot on={!svc?.watchdog?.critical} warn={svc?.watchdog?.critical} />
          <b className="text-text-1">감시견 (돈길)</b>
          <span className={`ml-auto text-xs font-data ${svc?.watchdog?.critical ? "text-neg" : "text-text-2"}`}>
            {svc?.watchdog?.critical ? "⚠ 경보" : svc?.arm_decision ? `ARM ${svc.arm_decision}` : "관찰중"}
          </span>
        </Row>
        <div className="mt-2 space-y-1">
          {(svc?.watchdog?.events ?? []).slice(-4).reverse().map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className={`shrink-0 ${e.severity === "critical" ? "text-neg" : e.severity === "good" ? "text-pos" : "text-text-3"}`}>●</span>
              <span className="text-text-2 flex-1">{e.msg}</span>
              <span className="text-text-3 font-data shrink-0">{ago(e.ts)}</span>
            </div>
          ))}
          {(svc?.watchdog?.events ?? []).length === 0 && (
            <div className="text-[11px] text-text-3">변화 없음 — 상태가 바뀔 때만 기록됨 (edge·ARM·OOS·TSMOM envelope).</div>
          )}
        </div>
        {svc?.pull_queue && (svc.pull_queue.pending > 0 || svc.pull_queue.running) && (
          <div className="mt-1.5 text-[10px] text-info">
            데이터 pull 큐: 대기 {svc.pull_queue.pending}{svc.pull_queue.running ? ` · 실행중 ${svc.pull_queue.running}` : ""}
          </div>
        )}
      </Card>

      {/* congress */}
      <Card>
        <Row><Dot on warn /><b className="text-text-1">Congress 피드</b>
          <span className="ml-auto text-xs text-text-3">온디맨드</span></Row>
        <div className="mt-1 text-[11px] text-text-3">{st?.congress?.note}</div>
      </Card>

      <div className="text-[10px] text-text-3 text-center pt-2">5초마다 자동 갱신 · localhost/LAN 자동</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-panel border border-border rounded-lg p-3">{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5">{children}</div>;
}
function Kv({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="bg-panel-2 border border-border rounded px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-3">{k}</div>
      <div className={`text-sm font-data ${warn ? "text-warn" : "text-text-1"}`}>{v}</div>
    </div>
  );
}
