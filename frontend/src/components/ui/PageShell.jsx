import React from 'react';

/**
 * Standard vertical rhythm for dashboard content pages.
 */
const PageShell = ({ children, className = '', wide = false }) => (
  <div
    className={[
      'page-shell-ats animate-page-enter',
      wide ? 'max-w-none' : '',
      className,
    ].filter(Boolean).join(' ')}
  >
    {children}
  </div>
);

export default PageShell;
