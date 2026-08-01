import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  cta: 'btn-cta-primary',
};

const SIZES = {
  sm: '!px-3.5 !py-2 !text-xs',
  md: '',
  lg: '!px-6 !py-3 !text-base',
};

/**
 * Shared button — wraps design-system classes for consistent CTAs.
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || ''} ${className}`.trim()}
    {...rest}
  >
    {loading && <Loader2 size={16} className="animate-spin" />}
    {children}
  </button>
);

export default Button;
