import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

// Il testo usa il font di sistema (vedi globals.css); Geist resta solo per il monospazio.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Milo Flow", template: "%s · Milo Flow" },
  description: "Gestionale per lavoro freelance e vita personale",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
