'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * Logo: uses your icon from public/logo.png when present.
 * Falls back to the default document+arrow mark if the image is missing or fails to load.
 */
const FALLBACK_SVG = (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
    aria-hidden
  >
    <path
      d="M8 4h10l6 6v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
      fill="currentColor"
      fillOpacity="0.95"
    />
    <path
      d="M18 4v6h6"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity="0.85"
    />
    <path
      d="M12 18h8l-4-5 4-5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity="0.9"
    />
  </svg>
);

export default function Logo({
  className = 'w-5 h-5',
  src = '/logo.png',
  useImage = true,
}: {
  className?: string;
  /** Path to logo image (e.g. /logo.svg or /logo.png). Used when useImage is true. */
  src?: string;
  /** If false, always show the fallback SVG. */
  useImage?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const useImg = useImage && !imgFailed;

  if (useImg) {
    return (
      <span className={`block relative ${className}`}>
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
          aria-hidden
        />
      </span>
    );
  }

  return <span className={`block ${className}`}>{FALLBACK_SVG}</span>;
}
