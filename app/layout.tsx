import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LanguageProvider } from "@/lib/i18n";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { AlertPoller } from "@/components/AlertPoller";
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
  title: "NAUTILUS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg text-text-1 font-ui antialiased m-0">
        <LanguageProvider>
          <header className="h-12 border-b border-border bg-panel flex items-center px-6 gap-6 shrink-0">
            <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">
              NAUTILUS
            </span>
            <NavBar />
            <div className="ml-auto flex items-center gap-4">
              <LanguageSwitcher />
              <span className="text-xs text-text-3 font-data">
                {new Date().toISOString().slice(0, 10)}
              </span>
            </div>
          </header>
          <main className="min-h-[calc(100vh-48px)]">
            {children}
          </main>
          <AlertPoller />
          <ToastContainer />
        </LanguageProvider>
      </body>
    </html>
  );
}
