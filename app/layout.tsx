import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CommandRail } from "@/components/console/CommandRail";
import { BottomTabBar } from "@/components/console/BottomTabBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { AlertPoller } from "@/components/AlertPoller";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SEOKMINAL",
  appleWebApp: {
    title: "SEOKMINAL",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF9F0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-ap-bg text-ap-ink-1 font-ui antialiased m-0">
        <div className="console-shell flex h-screen overflow-hidden">
          <CommandRail />
          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto pb-14 md:pb-0">
            {children}
          </main>
        </div>
        <BottomTabBar />
        <AlertPoller />
        <ToastContainer />
        <PwaRegister />
      </body>
    </html>
  );
}
