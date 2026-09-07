import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.BETTER_AUTH_URL || "https://traketo.com"

  return {
    rules: [
      {
        allow: [
          "/",
          "/about",
          "/contact",
          "/privacy",
          "/terms",
          "/sign-in",
          "/sign-up",
        ],
        disallow: [
          "/api/",
          "/app/",
          "/today",
          "/quests",
          "/timer",
          "/gates",
          "/cleared",
          "/progress",
          "/profile",
          "/settings",
          "/two-factor",
        ],
        userAgent: "*",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
