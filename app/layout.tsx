import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppChrome } from "@/components/AppChrome";
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
  title: "SEOKMINAL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg text-text-1 font-ui antialiased m-0">
        <LanguageProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            <AppChrome />
            <main className="flex-1 min-h-0 overflow-y-auto">
              {children}
            </main>
          </div>
          <AlertPoller />
          <ToastContainer />
        </LanguageProvider>
      </body>
    </html>
  );
}
