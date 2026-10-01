import React from 'react';

/**
 * Page header — title left, actions right on one row from md up.
 * Actions never force horizontal page overflow.
 */
const PageHeader = ({ icon: Icon, title, subtitle, children, className = '', gradientTitle = false }) => (
  <div className={`flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 ${className}`}>
    <div className="flex min-w-0 items-start gap-3 sm:gap-3.5 md:items-center">
      {Icon ? (
        <div className="icon-box-ats shrink-0">
          <Icon strokeWidth={2.25} aria-hidden="true" />
        </div>
      ) : null}
      <div className="min-w-0">
        <h1
          className={`text-2xl font-bold leading-tight tracking-tight sm:text-3xl ${
            gradientTitle ? 'text-gradient' : 'text-stone-900'
          }`}
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm font-medium leading-snug text-stone-500 sm:text-[15px]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
    {children ? (
      <div className="w-full min-w-0 md:w-auto md:max-w-[min(100%,36rem)] md:shrink-0">
        {children}
      </div>
    ) : null}
  </div>
);

export default PageHeader;
