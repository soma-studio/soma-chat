import type { Metadata } from "next";
import { Manrope, Roboto } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
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
  title: "Chatbot IA gratuit — SOMA Studio",
  description:
    "Ajoutez un chatbot IA à votre site en 5 minutes. Scraping automatique, indexation vectorielle, widget embeddable. Gratuit, open source.",
  openGraph: {
    title: "Chatbot IA gratuit — SOMA Studio",
    description:
      "Ajoutez un chatbot IA à votre site en 5 minutes. Gratuit, open source.",
    url: "https://chatbot.somastudio.xyz",
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
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
