"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function QuestsError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Tasks" />
}
