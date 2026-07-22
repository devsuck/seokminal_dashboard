"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { isConsoleRoute } from "@/components/console/CommandRail";

/**
 * 라우트에 따라 상단 레거시 네비(Sidebar)를 조건부 렌더.
 * 신규 콘솔 라우트(/command, /intel, ...)에서는 좌측 CommandRail이 셸을 담당하므로
 * 상단 네비를 숨긴다. 기존 45개 페이지는 그대로 상단 네비 유지.
 */
export function AppChrome() {
  const pathname = usePathname() || "";
  if (isConsoleRoute(pathname)) return null;
  return <Sidebar />;
}
