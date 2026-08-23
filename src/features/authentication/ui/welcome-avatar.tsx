import Image from "next/image"

export function WelcomeAvatar({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={478}
      priority
      src="/mascots/daymark-guide-blue-transparent.png"
      width={606}
    />
  )
}
