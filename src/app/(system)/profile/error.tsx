"use client"

import { RouteError } from "@/components/system/route-error"
import type { RouteErrorBoundaryProps } from "@/components/system/route-error"

export default function ProfileError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Profile" />
}
