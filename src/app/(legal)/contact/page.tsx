import type { Metadata } from "next"

import { getCurrentUser } from "@/features/authentication/server/authorization"
import { ContactExperience } from "@/features/support/components/contact-experience"

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  description: "Contact Traketo for account help, privacy, or feedback.",
  openGraph: { url: "/contact" },
  title: "Contact us",
}

export default async function ContactPage() {
  const user = await getCurrentUser()

  return (
    <ContactExperience initialEmail={user?.email} initialName={user?.name} />
  )
}
