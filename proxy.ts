import { NextRequest, NextResponse } from "next/server";
import { OLD_TO_NEW } from "@/lib/researchOsRedirects";

// 레거시 URL(옛 IA) 307 리다이렉트 — 예전엔 경로별 redirect() page.tsx 스텁 19개였음,
// 전부 이 맵 하나로 흡수. self-map(/research-os/validation → 자기 자신+?tab=)는 무한루프라 제외.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const target = OLD_TO_NEW[pathname];
  if (!target || target.split("?")[0] === pathname) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
