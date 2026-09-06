import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.BETTER_AUTH_URL || "https://traketo.com"
  const now = new Date()

  return [
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 1.0,
      url: `${baseUrl}/`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.8,
      url: `${baseUrl}/about`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${baseUrl}/contact`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${baseUrl}/privacy`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${baseUrl}/terms`,
    },
  ]
}
