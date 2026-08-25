import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#eaf1fe",
    description:
      "A private, offline-capable space to turn your intentions into finished tasks.",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icons/traketo-icon-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icons/traketo-icon-512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/traketo-icon-512.png",
        type: "image/png",
      },
    ],
    id: "/",
    name: "Traketo — Tasks & Habits",
    orientation: "portrait",
    scope: "/",
    short_name: "Traketo",
    start_url: "/today?source=pwa",
    theme_color: "#eaf1fe",
  }
}
