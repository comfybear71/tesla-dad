import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Tesla Dad",
  description: "Track TSLA, get buy/sell signals. Accumulate.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tesla Dad",
  },
};

// No maximumScale: pinch-zoom stays available (important for older eyes).
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-ink text-white antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 pt-6">
          {children}
        </div>
        <Nav />
      </body>
    </html>
  );
}
