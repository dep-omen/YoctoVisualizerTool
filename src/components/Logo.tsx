import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="8" y="4" width="16" height="3" rx="1.5" style={{ fill: 'var(--accent)', opacity: 0.4 }} />
      <rect x="6" y="9" width="20" height="3" rx="1.5" style={{ fill: 'var(--accent)', opacity: 0.6 }} />
      <rect x="4" y="14" width="24" height="3" rx="1.5" style={{ fill: 'var(--accent)', opacity: 1.0 }} />
      <rect x="6" y="19" width="20" height="3" rx="1.5" style={{ fill: 'var(--accent)', opacity: 0.6 }} />
      <rect x="8" y="24" width="16" height="3" rx="1.5" style={{ fill: 'var(--accent)', opacity: 0.4 }} />
    </svg>
  );
}
