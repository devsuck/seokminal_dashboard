import { VERDICT_TONE, type Verdict } from "@/lib/collectors";
import { Bar } from "./Bar";

/**
 * 수집기 신선도 = 마지막 write 경과 / stale 임계. 1.0을 넘으면 꽉 찬 바 + 경고색.
 * 이진 초록·빨강만으로는 "45초 전"과 "55분 전"이 같아 보이던 문제를 정도로 표현.
 */
export function FreshnessBar({ ageSec, staleAfterS, verdict }: {
  ageSec: number | null;
  staleAfterS: number;
  verdict: Verdict;
}) {
  const ratio = ageSec == null || staleAfterS <= 0 ? 1 : ageSec / staleAfterS;
  return <Bar ratio={ratio} tone={VERDICT_TONE[verdict].bar} />;
}
