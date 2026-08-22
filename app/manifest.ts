import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEOKMINAL",
    short_name: "SEOKMINAL",
    description: "SEOKMINAL 자동매매 대시보드",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFB",
    theme_color: "#FF9F0A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
