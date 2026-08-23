"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function ClearedError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Completed tasks" />
}
