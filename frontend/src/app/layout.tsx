import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BitLend - Bitcoin-Native Credit Protocol",
  description:
    "The first uncollateralized BNPL and credit layer on Bitcoin, powered by zkTLS underwriting on Stacks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white min-h-screen`}
      >
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-orange-500">
              BitLend
            </Link>
            <div className="flex gap-6 text-sm">
              <Link
                href="/profile"
                className="text-gray-400 hover:text-white transition"
              >
                Profile
              </Link>
              <Link
                href="/verify"
                className="text-gray-400 hover:text-white transition"
              >
                Verify
              </Link>
              <Link
                href="/apply"
                className="text-gray-400 hover:text-white transition"
              >
                Borrow
              </Link>
              <Link
                href="/repay"
                className="text-gray-400 hover:text-white transition"
              >
                Repay
              </Link>
              <Link
                href="/vault"
                className="text-gray-400 hover:text-white transition"
              >
                Vault
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
