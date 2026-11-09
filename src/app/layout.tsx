import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Poppins, Caveat } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-poppins" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Menewa Naya — Ensemble, on fait la différence",
  description:
    "Menewa Naya : plateforme solidaire de dons et de services communautaires de proximité pour le Togo, l'Afrique et la diaspora.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${caveat.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
