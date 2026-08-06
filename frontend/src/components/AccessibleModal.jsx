/**
 * Accessible modal shell with focus trapping, keyboard handling, and ARIA.
 *
 * Usage:
 *   <AccessibleModal open={isOpen} onClose={() => setIsOpen(false)} title="Edit">
 *     <form>...</form>
 *   </AccessibleModal>
 */
import { useEffect, useRef } from 'react';
import FocusLock from 'react-focus-lock';

export default function AccessibleModal({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  descriptionId,
  children,
  className = '',
  size = 'md',
}) {
  const backdropRef = useRef(null);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Global Escape handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full',
  }[size] || 'max-w-lg';

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(e) => {
        // Only close if click is directly on the backdrop, not a child
        if (e.target === backdropRef.current) onClose?.();
      }}
    >
      <FocusLock returnFocus>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={descriptionId}
          className={`${sizeClass} w-full ${className}`}
          tabIndex={-1}
        >
          {title ? (
            <h2 id={titleId} className="sr-only-if-hidden">
              {title}
            </h2>
          ) : null}
          {children}
        </div>
      </FocusLock>
    </div>
  );
}
