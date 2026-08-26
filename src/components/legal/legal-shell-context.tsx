"use client"

import { createContext, useContext, type ReactNode } from "react"

const LegalBackHrefContext = createContext<string>("/sign-in")

export function LegalShellContext({
  backHref,
  children,
}: {
  backHref: string
  children: ReactNode
}) {
  return (
    <LegalBackHrefContext.Provider value={backHref}>
      {children}
    </LegalBackHrefContext.Provider>
  )
}

export function useLegalBackHref(): string {
  return useContext(LegalBackHrefContext)
}
