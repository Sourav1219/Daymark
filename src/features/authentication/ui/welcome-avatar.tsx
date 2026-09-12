import Image from "next/image"

type WelcomeAvatarProps = {
  alt?: string
  className?: string
}

export function WelcomeAvatar({
  alt = "Traketo guide mascot illustration",
  className,
}: WelcomeAvatarProps) {
  return (
    <Image
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority="high"
      height={478}
      priority
      sizes="(max-width: 640px) 240px, 260px"
      src="/mascots/traketo-guide-blue-transparent.png"
      width={606}
    />
  )
}
