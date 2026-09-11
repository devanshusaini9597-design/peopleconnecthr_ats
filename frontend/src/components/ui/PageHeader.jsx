import React from 'react';

/**
 * Codester-style page header — icon tile + title/subtitle + optional actions.
 * Title column uses flex-1 so dense action rows never crush subtitle into one-word lines.
 */
const PageHeader = ({ icon: Icon, title, subtitle, children, className = '', gradientTitle = false }) => (
  <div className={`flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between ${className}`}>
    <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
      {Icon && (
        <div className="icon-box-ats shrink-0">
          <Icon strokeWidth={2.25} aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className={`text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${
            gradientTitle ? 'text-gradient' : 'text-stone-900'
          }`}
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-stone-500 sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children && (
      <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 xl:w-auto xl:max-w-[min(100%,28rem)] xl:justify-end">
        {children}
      </div>
    )}
  </div>
);

export default PageHeader;
