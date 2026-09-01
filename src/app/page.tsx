import { redirect } from "next/navigation"

import { getCurrentUser } from "@/features/authentication/server/authorization"

export default async function HomePage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/today")
  }

  redirect("/sign-in")
}
