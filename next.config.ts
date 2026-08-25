import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  devIndicators: false,
  // 폰 테스트용 cloudflared quick tunnel (2026-08-25, 임시 — 터널 재시작 시 호스트 바뀌면 갱신 필요)
  allowedDevOrigins: ["lights-curious-testing-cuisine.trycloudflare.com"],
};

export default nextConfig;
