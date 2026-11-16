import { useWindowDimensions } from 'react-native';

/**
 * Computes fluid viewport breakpoints and dimensions so screens, cards, headers,
 * and maps fill mobile, tablet, and widescreen desktop monitors naturally.
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWide = width >= 1360;
  const isCompactHeight = height < 820;

  const contentMaxWidth = isTablet ? Math.min(1680, Math.round(width * 0.94)) : width;
  const onboardingMaxWidth = isTablet ? Math.min(1640, Math.round(width * 0.94)) : width;
  const headerMaxWidth = isTablet ? Math.min(1720, Math.round(width * 0.96)) : width;
  const voiceMaxWidth = isTablet ? Math.min(920, Math.round(width * 0.72)) : width;

  const regionMapHeight = Math.round(
    Math.max(280, Math.min(560, height * (isDesktop ? 0.56 : isTablet ? 0.42 : 0.36)))
  );
  const desktopSideMapHeight = Math.round(
    Math.max(320, Math.min(640, height - 235))
  );
  const farmMapHeight = Math.round(
    Math.max(270, Math.min(580, isDesktop ? height - 255 : height * (isTablet ? 0.4 : 0.36)))
  );

  return {
    width,
    height,
    isTablet,
    isDesktop,
    isWide,
    isCompactHeight,
    contentMaxWidth,
    onboardingMaxWidth,
    headerMaxWidth,
    voiceMaxWidth,
    regionMapHeight,
    desktopSideMapHeight,
    farmMapHeight,
  };
}
