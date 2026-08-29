import { PageSkeleton } from "@/components/system/page-skeleton"

export default function AuthLoading() {
  return (
    <PageSkeleton
      description="Preparing your secure sign-in."
      eyebrow="Account"
      title="Loading"
    />
  )
}
