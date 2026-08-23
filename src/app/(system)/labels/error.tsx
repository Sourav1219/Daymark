"use client"

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/system/route-error"

export default function LabelsError(props: RouteErrorBoundaryProps) {
  return <RouteError {...props} routeName="Labels" />
}
