'use client';

/**
 * Standard page vertical rhythm for all dashboard screens.
 */
export default function PageShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-6 pb-8 min-w-0 w-full ${className}`.trim()}>
      {children}
    </div>
  );
}
