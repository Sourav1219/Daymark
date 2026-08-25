import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  description: "Sign in to Traketo.",
  title: {
    default: "Sign in",
    template: "%s",
  },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
