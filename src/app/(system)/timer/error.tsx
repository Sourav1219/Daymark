"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function TimerError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Timer" />
}
