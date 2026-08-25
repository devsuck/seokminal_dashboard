import type { CollectorKey } from "@/lib/api";

/** 수집기 키 → 한글 라벨 + 조사할 페이지. 서버 COLLECTOR_SESSIONS와 1:1. */
export const COLLECTOR_META: Record<CollectorKey, { label: string; href: string }> = {
  hl_orderflow_tick: { label: "HL 오더플로우 틱 수집기", href: "/orderflow" },
  cross_venue_skew_tick: { label: "크로스벤뉴 스큐 수집기", href: "/orderflow" },
  options_uoa: { label: "옵션 UOA 수집기", href: "/insider" },
  convergence_legs: { label: "컨버전스 레그 수집기", href: "/lab" },
};

export function collectorMeta(key: string): { label: string; href: string } {
  return COLLECTOR_META[key as CollectorKey] ?? { label: key, href: "/lab" };
}

export type Verdict = "fresh" | "stale" | "stuck" | "dead";

export const VERDICT_LABEL: Record<Verdict, string> = {
  fresh: "정상", stale: "지연", stuck: "멈춤", dead: "죽음",
};

/** verdict → 텍스트/배경 토큰. 정도는 FreshnessBar가, 종류는 이 색이 담당. */
export const VERDICT_TONE: Record<Verdict, { text: string; bg: string; bar: string }> = {
  fresh: { text: "text-pos", bg: "bg-pos/15", bar: "bg-pos" },
  stale: { text: "text-warn", bg: "bg-warn/15", bar: "bg-warn" },
  stuck: { text: "text-neg", bg: "bg-neg/15", bar: "bg-neg" },
  dead: { text: "text-neg", bg: "bg-neg/20", bar: "bg-neg" },
};
