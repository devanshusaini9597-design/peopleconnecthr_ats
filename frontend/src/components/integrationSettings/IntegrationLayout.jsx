import React from 'react';

export const Section = ({ title, icon: Icon, children }) => (
  <section className="animate-fade-in">
    <h2 className="section-title-ats">
      {Icon ? <Icon className="w-4 h-4 text-brand-600" /> : null}
      {title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {children}
    </div>
  </section>
);

export const LoadingSkeleton = () => (
  <div className="space-y-8 animate-fade-in">
    {[1, 2].map((section) => (
      <div key={section}>
        <div className="h-4 w-40 skeleton-ats mb-4 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3].map((card) => (
            <div key={card} className="card-ats-bordered p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="w-11 h-11 skeleton-ats rounded-xl" />
                <div className="h-6 w-24 skeleton-ats rounded-full" />
              </div>
              <div className="h-4 w-2/3 skeleton-ats rounded-lg" />
              <div className="h-3 w-full skeleton-ats rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
