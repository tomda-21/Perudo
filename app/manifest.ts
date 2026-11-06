import type { MetadataRoute } from "next";

// Manifeste PWA : « Sur l'écran d'accueil » (iPhone) / « Installer l'application » (Android)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Perudo",
    short_name: "Perudo",
    description: "Le Perudo en ligne, avec nos règles maison.",
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "any", // l'accueil reste libre ; le paysage n'est demandé qu'en salle d'attente et en partie
    background_color: "#1c0a30",
    theme_color: "#2a1640",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
