import type { Metadata } from "next"

import { requireUser } from "@/features/authentication/server/authorization"
import { ContactExperience } from "@/features/support/components/contact-experience"

export const metadata: Metadata = {
  description: "Contact Traketo for account help, privacy, or feedback.",
  title: "Contact us",
}

export default async function ContactPage() {
  const user = await requireUser()

  return <ContactExperience email={user.email} name={user.name} />
}
