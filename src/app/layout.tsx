import { SerwistProvider } from "@serwist/turbopack/react"
import type { Metadata, Viewport } from "next"
import { cookies, headers } from "next/headers"
import Script from "next/script"
import type { ReactNode } from "react"

import "./globals.css"
import { Baloo_2, Caveat, Inter, Nunito } from "next/font/google"
import { DevServiceWorkerCleanup } from "@/components/system/dev-service-worker-cleanup"
import { SentryFeedbackWidget } from "@/components/system/sentry-feedback-widget"
import {
  cookieConsentName,
  parseCookieConsent,
} from "@/features/privacy/domain/cookie-consent"
import { CookieConsentProvider } from "@/features/privacy/ui/cookie-consent-provider"
import { cn } from "@/lib/utils"

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
})
const caveat = Caveat({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
})
// Rounded, friendly display + UI faces used by the redesigned auth surfaces.
// Exposed as scoped CSS variables so the app shell keeps its Inter default.
const baloo = Baloo_2({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-baloo",
})
const nunito = Nunito({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-nunito",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://traketo.com"),
  applicationName: "Traketo",
  appleWebApp: {
    capable: true,
    startupImage: "/splash/traketo-splash-portrait.png",
    statusBarStyle: "default",
    title: "Traketo",
  },
  title: {
    default: "Traketo",
    template: "%s | Traketo",
  },
  description:
    "A calm, private space to turn your intentions into finished tasks.",
  formatDetection: { email: false, telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    description:
      "A calm, private space to turn your intentions into finished tasks.",
    siteName: "Traketo",
    title: "Traketo",
    type: "website",
    url: "/",
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  initialScale: 1,
  themeColor: "#eaf1fe",
  width: "device-width",
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default async function RootLayout({ children }: RootLayoutProps) {
  const [requestHeaders, cookieStore] = await Promise.all([
    headers(),
    cookies(),
  ])
  const requestNonce = requestHeaders.get("x-nonce") ?? undefined
  const initialConsent = parseCookieConsent(
    cookieStore.get(cookieConsentName)?.value,
  )

  return (
    <html
      lang="en"
      className={cn(
        "font-sans",
        inter.variable,
        caveat.variable,
        baloo.variable,
        nunito.variable,
      )}
    >
      <body>
        <CookieConsentProvider initialConsent={initialConsent}>
          {process.env.NODE_ENV !== "production" ? (
            <Script
              nonce={requestNonce}
              src="/dev-cache-cleanup.js"
              strategy="beforeInteractive"
            />
          ) : null}
          <DevServiceWorkerCleanup />
          <SentryFeedbackWidget />
          <SerwistProvider
            disable={process.env.NODE_ENV !== "production"}
            options={{ scope: "/", updateViaCache: "none" }}
            swUrl="/serwist/sw.js"
          >
            {children}
          </SerwistProvider>
        </CookieConsentProvider>
      </body>
    </html>
  )
}
