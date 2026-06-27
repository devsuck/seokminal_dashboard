import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
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

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/market",       label: "Market" },
  { href: "/backtest",     label: "Backtest" },
  { href: "/experiments",  label: "Experiments" },
  { href: "/strategies",   label: "Strategies" },
  { href: "/notebooks",    label: "Notebooks" },
  { href: "/quant",        label: "Research" },
  { href: "/correlation",  label: "Correlation" },
  { href: "/event-study",  label: "Event Study" },
  { href: "/universe",     label: "Universe" },
  { href: "/rolling",      label: "Rolling" },
  { href: "/factor",       label: "Factor" },
  { href: "/bots",         label: "Bots" },
  { href: "/ai-trader",    label: "AI Trader" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg text-text-1 font-ui antialiased m-0">
        <header className="h-12 border-b border-border bg-panel flex items-center px-6 gap-8 shrink-0">
          <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">
            NAUTILUS
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 text-sm text-text-3 hover:text-text-1 rounded transition-colors duration-150 no-underline"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-text-3 font-data">
            {new Date().toISOString().slice(0, 10)}
          </div>
        </header>
        <main className="min-h-[calc(100vh-48px)]">
          {children}
        </main>
      </body>
    </html>
  );
}
