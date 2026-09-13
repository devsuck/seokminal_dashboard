import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  devIndicators: false,
  // 폰 테스트용 — cloudflared 터널(임시, 재시작 시 갱신 필요) + LAN/Tailscale IP
  allowedDevOrigins: [
    "lights-curious-testing-cuisine.trycloudflare.com",
    "192.168.45.130",
    "192.168.45.130:3000",
    "100.108.67.7",
    "100.108.67.7:3000",
  ],
};

export default nextConfig;
