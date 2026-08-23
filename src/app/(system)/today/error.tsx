"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function TodayError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Home" />
}
