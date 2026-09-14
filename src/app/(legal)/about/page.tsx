import type { Metadata } from "next"

import { AboutContent } from "@/features/about/ui/about-content"

export const metadata: Metadata = {
  alternates: { canonical: "/about" },
  description:
    "Meet Traketo, a calm space for planning tasks, focusing, and making progress together.",
  openGraph: { url: "/about" },
  title: "About Traketo",
}

export default function AboutPage() {
  return <AboutContent />
}
