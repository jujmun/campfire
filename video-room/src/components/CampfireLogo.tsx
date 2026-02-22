interface CampfireLogoProps {
  size?: number
  className?: string
}

export function CampfireLogo({ size = 24, className = '' }: CampfireLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="campfire-flame" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      {/* Stylized campfire flames */}
      <path
        d="M12 21c-3.5-3-3.5-6.5-3.5-10 0-1.75 1.25-3.5 3.5-3.5s3.5 1.75 3.5 3.5c0 3.5 0 7-3.5 10z"
        fill="url(#campfire-flame)"
      />
      <path
        d="M12 19c-2-2-2-4.5-2-7 0-1.2.6-2 2-2s2 .8 2 2c0 2.5 0 5-2 7z"
        fill="#fef3c7"
        opacity="0.7"
      />
    </svg>
  )
}
