import React from 'react';

/** Product brand — logo asset lives in /public/logo.png */
export const BRAND_NAME = 'People Connect HR';
export const BRAND_LOGO_SRC = '/logo.png';

const SIZE_CLASS = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
  '2xl': 'w-16 h-16',
};

/**
 * Official product logo mark used across landing, auth, dashboard, and loaders.
 */
export default function BrandLogo({
  size = 'md',
  className = '',
  rounded = true,
  shadow = false,
  alt = BRAND_NAME,
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      width={64}
      height={64}
      decoding="async"
      className={[
        SIZE_CLASS[size] || SIZE_CLASS.md,
        rounded ? 'rounded-xl' : '',
        shadow ? 'shadow-lg shadow-brand-500/20' : '',
        'object-cover flex-shrink-0 bg-teal-900/5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
