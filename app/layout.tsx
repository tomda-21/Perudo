import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

// Polices façon jeu vidéo : Lilita One pour les titres, Nunito pour le texte
const title = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-title-loaded", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-body-loaded", display: "swap" });

export const metadata: Metadata = {
  title: "Perudo Tomda — bluff, dés et menteurs entre potes",
  description: "Le Perudo en ligne, avec nos règles maison.",
};

export const viewport: Viewport = { themeColor: "#2a1640", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${title.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
