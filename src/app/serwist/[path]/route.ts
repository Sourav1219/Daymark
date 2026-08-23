import { createSerwistRoute } from "@serwist/turbopack"

export const { dynamic, dynamicParams, generateStaticParams, GET, revalidate } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { revision: "phase-8-v1", url: "/~offline" },
      { revision: "phase-8-v1", url: "/manifest.webmanifest" },
    ],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  })
