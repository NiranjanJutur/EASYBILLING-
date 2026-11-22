import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo } from './PromoVideo';

export const Root: React.FC = () => {
  return (
    <>
      {/* 16:9 Landscape - Ideal for GitHub README, Reddit, YouTube, Desktop */}
      <Composition
        id="EasyBillingPromo"
        component={PromoVideo}
        durationInFrames={1030}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
