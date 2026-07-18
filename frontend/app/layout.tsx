import type { Metadata } from "next";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "World Cup Oracle — On-chain predictions, AI-analyzed",
  description: "Stake on World Cup outcomes and unlock AI match analysis, settled natively on Injective.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
<body suppressHydrationWarning className="min-h-full flex flex-col bg-pitch-deep text-chalk">{children}</body>    </html>
  );
}
