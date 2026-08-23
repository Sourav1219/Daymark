"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function SettingsError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Settings" />
}
