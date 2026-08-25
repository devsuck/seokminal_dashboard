/** 엣지 졸업 등급·검증 상태의 단일 라벨 출처. /edges·/lab이 같은 말을 쓰게 함. */

export function gradeStyle(s: string): string {
  if (s === "graduated") return "border-pos/50 text-pos bg-pos/10";
  if (s === "failed") return "border-neg/50 text-neg bg-neg/10";
  return "border-warn/40 text-warn bg-warn/10"; // accumulating
}

export function gradeLabel(s: string): string {
  return ({ graduated: "졸업", failed: "탈락", accumulating: "축적중" } as Record<string, string>)[s] ?? s;
}

export function edgeStatusLabel(s: string): string {
  return ({
    significant: "유의(FDR생존)", not_significant: "미유의", no_data: "데이터없음",
    warming: "계산중", pending: "대기(맥조립)", error: "오류",
  } as Record<string, string>)[s] ?? s;
}
