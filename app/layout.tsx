import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nautilus Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <nav className="bg-white border-b border-gray-200 px-8 py-4 flex gap-6">
          <Link href="/" className="font-medium">
            Market
          </Link>
          <Link href="/backtest" className="font-medium">
            Backtest
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
