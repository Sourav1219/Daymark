import type { ReactNode } from "react"

import { LegalShellContext } from "@/components/legal/legal-shell-context"

/**
 * Layout for public legal pages (about, privacy, terms).
 *
 * These pages are deliberately request-independent so Vercel can serve them
 * from the CDN. BackButton restores authenticated visitors' browser history;
 * direct visits use the public sign-in page as the safe fallback.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalShellContext backHref="/sign-in">{children}</LegalShellContext>
}
