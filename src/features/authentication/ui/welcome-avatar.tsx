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
      decoding="sync"
      fetchPriority="high"
      height={478}
      loading="eager"
      preload
      src="/mascots/traketo-guide-blue-transparent.webp"
      unoptimized
      width={606}
    />
  )
}
