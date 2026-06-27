import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAUTILUS TERMINAL",
};

const NAV_ITEMS = [
  { href: "/", label: "F1:MARKET" },
  { href: "/backtest", label: "F2:BACKTEST" },
  { href: "/quant", label: "F3:QUANT" },
  { href: "/bots", label: "F4:BOTS" },
  { href: "/ai-trader", label: "F5:AI-TRADER" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: "#090909", colorScheme: "dark" }}>
      <body style={{ background: "#090909", color: "#e8e8e8", fontFamily: "'Courier New', Courier, monospace", margin: 0, fontSize: 14 }}>
        <header style={{ borderBottom: "1px solid #2a2a2a", background: "#0d0d0d" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", gap: 32 }}>
            <span style={{ color: "#ff8c00", fontWeight: "bold", fontSize: 16, letterSpacing: 2 }}>
              NAUTILUS
            </span>
            <nav style={{ display: "flex", gap: 2 }}>
              {NAV_ITEMS.map(({ href, label }) => (
                <Link key={href} href={href}
                  style={{ color: "#aaa", fontSize: 13, padding: "5px 14px", textDecoration: "none",
                    borderRight: "1px solid #2a2a2a" }}
                  className="nav-link">
                  {label}
                </Link>
              ))}
            </nav>
            <div style={{ marginLeft: "auto", color: "#666", fontSize: 12 }}>
              {new Date().toISOString().slice(0, 10)}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
