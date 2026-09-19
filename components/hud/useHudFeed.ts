"use client";

import { useEffect, useRef, useState } from "react";
import {
  getLabState, getJarvisStatus, getAutoResearch, getBuybackBot, listAgents, getLabStatus,
  getExecutionConsole, getExecutionEdge, getAccountBalances, getTriggeredAlerts,
  getLabHealth, getFleet,
  type LabState, type JarvisStatus, type AutoResearchStatus, type BuybackBot,
  type TradingAgent, type LabStatus, type ExecutionConsole, type ExecutionEdge,
  type AccountBalances, type TriggeredAlert, type LabHealth, type FleetResponse,
} from "@/lib/api";
import {
  getConsolePipeline, getRisk, getInvestmentOs, getGodModeCandidates, getCapitalClaimCandidates,
  type ConsolePipeline, type RiskResp, type InvestmentOsResp,
  type GodModeCandidatesResp, type CapitalClaimCandidatesResp,
} from "@/lib/console-api";

export interface HudFeed {
  lab: LabState | null; jarvis: JarvisStatus | null; ar: AutoResearchStatus | null;
  bot: BuybackBot | null; agents: TradingAgent[] | null; sys: LabStatus | null;
  exec: ExecutionConsole | null; edge: ExecutionEdge | null; alerts: TriggeredAlert[] | null;
  health: LabHealth | null; fleet: FleetResponse | null;
  pipeline: ConsolePipeline | null; risk: RiskResp | null; ios: InvestmentOsResp | null;
  godCandidates: GodModeCandidatesResp | null; claimCandidates: CapitalClaimCandidatesResp | null;
}

/** /hud 페이지 공용 폴링 — 15개 엔드포인트를 화면 곳곳에서 각자 호출하지 않도록 여기 하나로 뺌. */
export function useHudFeed() {
  const [f, setF] = useState<HudFeed>({ lab: null, jarvis: null, ar: null, bot: null, agents: null, sys: null, exec: null, edge: null, alerts: null, health: null, fleet: null, pipeline: null, risk: null, ios: null, godCandidates: null, claimCandidates: null });
  const [bal, setBal] = useState<AccountBalances | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      abortRef.current?.abort();
      const c = new AbortController();
      abortRef.current = c;
      const [lab, jarvis, ar, bot, agentsRes, sys, exec, edge, alerts, health, fleet] = await Promise.all([
        getLabState(c.signal).catch(() => null),
        getJarvisStatus(c.signal).catch(() => null),
        getAutoResearch(c.signal).catch(() => null),
        getBuybackBot(c.signal).catch(() => null),
        listAgents(c.signal).catch(() => null),
        getLabStatus(c.signal).catch(() => null),
        getExecutionConsole(c.signal).catch(() => null),
        getExecutionEdge(c.signal).catch(() => null),  // read_only 캐시 — 서버 계산 없음
        getTriggeredAlerts(c.signal).catch(() => null),
        getLabHealth(c.signal).catch(() => null),  // 봇·에이전트 정합성 불변식
        getFleet(c.signal).catch(() => null),      // 수집기 신선도 판정(fresh/stale/stuck/dead)
      ]);
      if (mounted && !c.signal.aborted) setF((prev) => ({ ...prev, lab, jarvis, ar, bot, agents: agentsRes?.agents ?? null, sys, exec, edge, alerts, health, fleet }));
    }
    load();
    const iv = setInterval(load, 4000);
    return () => { mounted = false; clearInterval(iv); abortRef.current?.abort(); };
  }, []);

  // 계좌 잔액은 KIS/IB 등 외부 브로커 API를 직접 호출해 5~30초씩 걸릴 수 있음 —
  // 4초 주기 메인 피드 루프에 섞으면 abort-then-check 경합으로 상태 갱신 자체가 막힘.
  // 별도의 느린 주기로 독립 폴링.
  // pipeline/risk/investment-os도 여기서 같이 폴링 — getInvestmentOs는 validate_separation()이
  // 매 요청마다 ast.parse로 소스 트리를 재파싱해 200ms+ 걸림. 판단 필요 신호는 초단위 신선도가
  // 필요 없으므로(30초면 충분) 4초 메인 루프에 두면 상시 열려있는 홈페이지에서 CPU를 계속 태움.
  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    async function loadBal() {
      if (inFlight) return;
      inFlight = true;
      try {
        const b = await getAccountBalances();
        if (mounted) setBal(b);
      } catch { /* 이전 값 유지 */ }
      const [pipeline, risk, ios, godCandidates, claimCandidates] = await Promise.all([
        getConsolePipeline().catch(() => null),
        getRisk().catch(() => null),
        getInvestmentOs(1_000_000).catch(() => null),
        getGodModeCandidates().catch(() => null),
        getCapitalClaimCandidates().catch(() => null),
      ]);
      if (mounted) setF((prev) => ({ ...prev, pipeline, risk, ios, godCandidates, claimCandidates }));
      inFlight = false;
    }
    loadBal();
    const iv = setInterval(loadBal, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return { feed: f, bal };
}
