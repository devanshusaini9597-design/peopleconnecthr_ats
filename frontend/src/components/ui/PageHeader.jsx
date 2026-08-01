import React from 'react';

/**
 * Codester-style page header — icon tile + title/subtitle + optional actions.
 */
const PageHeader = ({ icon: Icon, title, subtitle, children, className = '', gradientTitle = false }) => (
  <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className}`}>
    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
      {Icon && (
        <div className="icon-box-ats">
          <Icon strokeWidth={2.5} />
        </div>
      )}
      <div className="min-w-0">
        <h1
          className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight ${
            gradientTitle ? 'text-gradient' : 'text-stone-900'
          }`}
          style={{ letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-stone-500 text-sm sm:text-base mt-1.5 font-medium leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children && (
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 w-full sm:w-auto">
        {children}
      </div>
    )}
  </div>
);

export default PageHeader;
