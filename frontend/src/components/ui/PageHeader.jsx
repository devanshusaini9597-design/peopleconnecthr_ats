import React from 'react';

/**
 * Codester-style page header — icon tile + title/subtitle + optional actions.
 * Title column uses flex-1 so dense action rows never crush subtitle into one-word lines.
 */
const PageHeader = ({ icon: Icon, title, subtitle, children, className = '', gradientTitle = false }) => (
  <div className={`flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 ${className}`}>
    <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
      {Icon && (
        <div className="icon-box-ats shrink-0">
          <Icon strokeWidth={2.5} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${
            gradientTitle ? 'text-gradient' : 'text-stone-900'
          }`}
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-stone-500 text-sm sm:text-base mt-1.5 font-medium leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children && (
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 w-full lg:w-auto lg:max-w-[48%] lg:justify-end">
        {children}
      </div>
    )}
  </div>
);

export default PageHeader;
