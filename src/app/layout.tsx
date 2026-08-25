import { SerwistProvider } from "@serwist/turbopack/react"
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { connection } from "next/server"
import Script from "next/script"
import type { ReactNode } from "react"

import "./globals.css"
import { Baloo_2, Caveat, Inter, Nunito } from "next/font/google"
import { DevServiceWorkerCleanup } from "@/components/system/dev-service-worker-cleanup"
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
  alternates: { canonical: "/" },
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
  formatDetection: { telephone: false },
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
  // A nonce-based CSP must be rendered per request so Next.js can attach the
  // proxy-provided nonce to framework scripts and inline styles.
  await connection()
  const requestNonce = (await headers()).get("x-nonce") ?? undefined

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
        {process.env.NODE_ENV !== "production" ? (
          <Script
            nonce={requestNonce}
            src="/dev-cache-cleanup.js"
            strategy="beforeInteractive"
          />
        ) : null}
        <DevServiceWorkerCleanup />
        <SerwistProvider
          disable={process.env.NODE_ENV !== "production"}
          options={{ scope: "/", updateViaCache: "none" }}
          swUrl="/serwist/sw.js"
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  )
}
