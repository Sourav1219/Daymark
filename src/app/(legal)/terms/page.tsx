import type { Metadata } from "next"

import { TermsExperience } from "@/features/terms/ui/terms-experience"

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  description: "The terms that apply when you access or use Traketo.",
  title: "Terms of Service",
}

export default function TermsPage() {
  return <TermsExperience />
}
