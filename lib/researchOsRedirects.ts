export const OLD_TO_NEW: Record<string, string> = {
  "/research-os/workflow": "/research-os/pipeline?tab=workflow",
  "/research-os/discovery": "/research-os/pipeline?tab=discovery",
  "/research-os/strategy-generation": "/research-os/pipeline?tab=strategy-generation",
  "/research-os/strategy-lab": "/research-os/pipeline?tab=strategy-lab",
  "/research-os/agents": "/research-os/pipeline?tab=agents",
  "/research-os/brain": "/research-os/pipeline?tab=brain",
  "/research-os/cockpit": "/research-os/pipeline?tab=cockpit",
  "/research-os/console": "/research-os/pipeline?tab=console",
  // 자기 자신으로 매핑(의도적) — /research-os/validation은 이미 이 shell 페이지이고 기본
  // 탭이 "validation"이라 이 항목은 현재 어떤 리다이렉트 스텁에서도 쓰이지 않음(Task 5가
  // 일부러 이 경로만 스텁을 생성하지 않음, shell이 자기 자신으로 무한 리다이렉트되는 걸 피하려고).
  // 값은 바꾸지 말 것: 훗날 redirect(OLD_TO_NEW[pathname]) 식으로 이 맵을 범용 소비하는
  // 코드(예: middleware)가 추가되면 바로 이 키에서 무한루프에 빠짐.
  "/research-os/validation": "/research-os/validation?tab=validation",
  "/research-os/production": "/research-os/validation?tab=production",
  "/research-os/intelligence-plus": "/research-os/validation?tab=intelligence-plus",
  "/research-os/committee": "/research-os/governance?tab=committee",
  "/research-os/explain": "/research-os/governance?tab=explain",
  "/research-os/graph": "/research-os/governance?tab=graph",
  "/research-os/timeline": "/research-os/governance?tab=timeline",
  // ── HUD 탭쉘 흡수(2026-08-22 가지치기) ──
  "/lab": "/hud?tab=lab",
  "/lab/execution": "/hud?tab=execution",
  "/lab/tasks": "/hud?tab=tasks",
  "/overview": "/hud?tab=portfolio",
  "/auto-research": "/hud?tab=lab",
  // ── Investment OS 흡수(이미 5탭 통합 완료, 리다이렉트만) ──
  "/council/agents": "/investment-os?tab=risk",
  "/council/decisions": "/investment-os?tab=risk",
  "/council/logs": "/investment-os?tab=risk",
  "/exec/monitor": "/investment-os?tab=ops",
  "/exec/orders": "/investment-os?tab=ops",
  "/portfolio-os/allocation": "/investment-os?tab=overview",
  "/portfolio-os/positions": "/investment-os?tab=overview",
  "/portfolio-os/risk": "/investment-os?tab=risk",
  // ── 컨텍스트 드릴다운(/agents 흡수). agents 탭은 URL 동기화 안 하므로 쿼리 없이 이동 ──
  "/calendar": "/agents",
  "/insider": "/agents",
  "/macro": "/agents",
  "/news": "/agents",
};
