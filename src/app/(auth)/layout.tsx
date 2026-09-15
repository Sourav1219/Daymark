import type { Metadata } from "next"
import type { ReactNode } from "react"

import "@/app/styles/sign-up-welcome-screen.css"

export const metadata: Metadata = {
  description: "Sign in to Traketo.",
  title: {
    default: "Sign in | Traketo",
    template: "%s | Traketo",
  },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
      {children}
    </>
  )
}
