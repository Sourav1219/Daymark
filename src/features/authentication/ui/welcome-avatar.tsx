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
      height={478}
      priority
      src="/mascots/traketo-guide-blue-transparent.png"
      width={606}
    />
  )
}
