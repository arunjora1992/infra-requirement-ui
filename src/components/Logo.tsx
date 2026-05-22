import { cn } from "@/lib/utils";

export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="lg-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <filter id="lg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* tile */}
      <rect x="1" y="1" width="38" height="38" rx="9" fill="url(#lg-fill)" />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="8.5"
        fill="none"
        stroke="url(#lg-stroke)"
        strokeOpacity="0.55"
        strokeWidth="1"
      />

      {/* server bars */}
      <g filter="url(#lg-glow)">
        <rect x="9" y="10" width="22" height="4.5" rx="1.2" fill="white" />
        <rect x="9" y="17"   width="22" height="4.5" rx="1.2" fill="white" fillOpacity="0.8" />
        <rect x="9" y="24" width="14" height="4.5" rx="1.2" fill="white" fillOpacity="0.55" />
      </g>

      {/* live status dot */}
      <circle cx="27.5" cy="26.25" r="2.2" fill="#34d399" />
      <circle cx="27.5" cy="26.25" r="2.2" fill="#34d399" opacity="0.55">
        <animate
          attributeName="r"
          values="2.2;4.5;2.2"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.55;0;0.55"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
