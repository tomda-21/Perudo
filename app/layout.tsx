import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perudo entre potes",
  description: "Le Perudo en ligne, avec nos règles maison.",
};

export const viewport: Viewport = { themeColor: "#0f2a22", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
