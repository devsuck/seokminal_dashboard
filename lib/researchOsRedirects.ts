export const OLD_TO_NEW: Record<string, string> = {
  // 자기 자신으로 매핑(의도적) — /research-os/validation은 이미 이 shell 페이지이고 기본
  // 탭이 "validation". proxy.ts가 target === pathname이면 통과시켜 무한루프 방지.
  "/research-os/validation": "/research-os/validation?tab=validation",
  "/research-os/production": "/research-os/validation?tab=production",
  "/research-os/intelligence-plus": "/research-os/validation?tab=intelligence-plus",
  "/research-os/committee": "/research-os/governance?tab=committee",
  "/research-os/explain": "/research-os/governance?tab=explain",
  "/research-os/graph": "/research-os/governance?tab=graph",
  "/research-os/timeline": "/research-os/governance?tab=timeline",
  // ── HUD 탭쉘 흡수(2026-08-22 가지치기) ──
  "/overview": "/hud?tab=portfolio",
  // AI LAB 통제판(구 /lab, /research-os/pipeline) 자체는 read-only 리뉴얼(2026-08-25)에서
  // 삭제됐지만, 리서치 후보 검토 기능은 살아있음 — 거기로.
  "/auto-research": "/investment-os/research-candidates",
  // ── Investment OS 흡수(이미 5탭 통합 완료, 리다이렉트만) ──
  "/council/agents": "/investment-os?tab=risk",
  "/council/decisions": "/investment-os?tab=risk",
  "/council/logs": "/investment-os?tab=risk",
  "/exec/monitor": "/investment-os?tab=ops",
  "/exec/orders": "/investment-os?tab=ops",
  "/portfolio-os/allocation": "/investment-os?tab=overview",
  "/portfolio-os/positions": "/investment-os?tab=overview",
  "/portfolio-os/risk": "/investment-os?tab=risk",
  // ── 컨텍스트 드릴다운(옛 /agents 흡수, 지금은 /agents 자체가 없어져 /hud로) ──
  "/calendar": "/hud",
  "/insider": "/hud",
  "/hud/summary": "/hud",
};
