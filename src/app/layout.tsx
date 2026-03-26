import type { Metadata } from "next";
import { Manrope, Roboto } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["900"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://chatbot.somastudio.xyz'),
  title: {
    default: 'Chatbot IA gratuit — SOMA Studio',
    template: '%s — SOMA Studio',
  },
  description:
    'Chatbot IA gratuit par SOMA Studio. Testez un assistant intelligent directement sur votre navigateur.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'SOMA Studio',
    images: [
      { url: '/og-default.png', width: 1200, height: 630, alt: 'SOMA Chat — Chatbot IA gratuit pour votre site web' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-default.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${manrope.variable} ${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
