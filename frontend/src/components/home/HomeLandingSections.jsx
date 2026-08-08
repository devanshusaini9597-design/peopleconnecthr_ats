import React from 'react';
import { HomeFeatures } from './HomeFeatures';
import { HomeProductTour } from './HomeProductTour';
import { HomeVideoDemo } from './HomeVideoDemo';
import { HomeHowItWorks, HomeIntegrations, HomeTestimonials } from './HomeHowItWorks';
import { PricingSection } from './PricingSection';
import { SecuritySection } from './SecuritySection';
import { DemoSection } from './DemoSection';
import { FaqSection } from './FaqSection';

export function HomeLandingSections({
  activeTab,
  setActiveTab,
  videoPlaying,
  setVideoPlaying,
  activeChapter,
  setActiveChapter,
}) {
  return (
    <>
      <HomeFeatures />
      <HomeProductTour activeTab={activeTab} setActiveTab={setActiveTab} />
      <HomeVideoDemo
        videoPlaying={videoPlaying}
        setVideoPlaying={setVideoPlaying}
        activeChapter={activeChapter}
        setActiveChapter={setActiveChapter}
      />
      <HomeHowItWorks />
      <HomeIntegrations />
      <HomeTestimonials />
      <PricingSection />
      <SecuritySection />
      <DemoSection />
      <FaqSection />
    </>
  );
}
