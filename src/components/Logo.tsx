interface LogoProps {
  size?: number
  title?: string
}

/** The Koe mark: two rounded strokes forming the kana ko (こ) on indigo. */
export function Logo({ size = 40, title = 'Koe' }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={title}>
      <rect width="512" height="512" rx="115" fill="#2B3A67" />
      <rect x="181" y="172" width="150" height="45" rx="22.5" fill="#FF7A59" />
      <path
        d="M 168 272 H 318 A 55 55 0 0 1 318 382 H 168"
        fill="none"
        stroke="#FAF7F2"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
