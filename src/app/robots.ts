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
          "/verify-email",
          "/forgot-password",
          "/reset-password",
          "/session-expired",
          "/sign-out",
          "/today",
          "/quests",
          "/timer",
          "/gates",
          "/cleared",
          "/progress",
          "/profile",
          "/settings",
          "/~offline",
        ],
        userAgent: "*",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
