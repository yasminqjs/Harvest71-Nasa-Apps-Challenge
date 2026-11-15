import React from 'react';
import { BahiaRegionPreset } from '../data/seedData';
import { AppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';

export interface NordesteLeafletMapProps {
  selectedRegionName: string;
  gpsDetectedRegionId?: string | null;
  gpsUserCoords?: GeoPoint | null;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  onFallbackOffline?: () => void;
  theme: AppTheme;
}

export const NordesteLeafletMap: React.FC<NordesteLeafletMapProps> = () => {
  return null;
};
