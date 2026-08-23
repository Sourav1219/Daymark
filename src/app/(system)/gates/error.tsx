"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function GatesError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Lists" />
}
