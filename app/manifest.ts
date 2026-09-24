import type { MetadataRoute } from "next";

// Manifest della PWA: l'app si installa dal browser (Aggiungi al Dock su
// macOS, Aggiungi a Home su iPhone) e parte dalla pagina Oggi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Milo Flow",
    short_name: "Milo Flow",
    description: "Gestionale per lavoro freelance e vita personale",
    lang: "it",
    start_url: "/oggi",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icona-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icona-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icona-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
