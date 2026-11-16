import { useWindowDimensions } from 'react-native';

/**
 * Computes fluid viewport dimensions, sidebar widths, map heights, and grid column counts
 * so every screen dynamically adapts to phones, tablets, laptops, and widescreen monitors.
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWide = width >= 1360;
  const isCompactHeight = height < 820;

  const sidebarWidth = width >= 1360 ? 216 : isDesktop ? 188 : 0;
  const workspaceWidth = Math.max(300, width - sidebarWidth);
  const pagePadding = Math.round(Math.max(12, Math.min(28, workspaceWidth * 0.022)));

  const kpiColumns = workspaceWidth >= 820 ? 4 : 2;
  const gridColumns = workspaceWidth >= 1120 ? 3 : workspaceWidth >= 640 ? 2 : 1;

  // Allow workspace content to fill the active pane cleanly while remaining legible on ultrawide monitors
  const contentMaxWidth = isTablet ? Math.min(1800, workspaceWidth) : width;
  const onboardingMaxWidth = isTablet ? Math.min(1760, Math.round(width * 0.96)) : width;
  const headerMaxWidth = isTablet ? Math.min(1800, width) : width;
  const voiceMaxWidth = isTablet ? Math.min(820, Math.round(width * 0.72)) : width;

  const regionMapHeight = Math.round(
    Math.max(260, Math.min(560, height * (isDesktop ? 0.54 : isTablet ? 0.42 : 0.36)))
  );
  const desktopSideMapHeight = Math.round(
    Math.max(320, Math.min(680, height - 210))
  );
  const farmMapHeight = Math.round(
    Math.max(260, Math.min(600, isDesktop ? height - 230 : height * (isTablet ? 0.4 : 0.36)))
  );

  return {
    width,
    height,
    isTablet,
    isDesktop,
    isWide,
    isCompactHeight,
    sidebarWidth,
    workspaceWidth,
    pagePadding,
    kpiColumns,
    gridColumns,
    contentMaxWidth,
    onboardingMaxWidth,
    headerMaxWidth,
    voiceMaxWidth,
    regionMapHeight,
    desktopSideMapHeight,
    farmMapHeight,
  };
}
