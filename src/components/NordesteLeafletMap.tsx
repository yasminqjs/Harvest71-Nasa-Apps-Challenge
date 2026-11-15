import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { pickLang } from '../i18n/locale';
import { AppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';
import { buildNordesteLeafletHtml } from '../utils/leafletHtml';

export interface NordesteLeafletMapProps {
  selectedRegionName: string;
  gpsDetectedRegionId?: string | null;
  gpsUserCoords?: GeoPoint | null;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  onFallbackOffline?: () => void;
  theme: AppTheme;
}

type LeafletIframeWindow = Window & {
  __updateMapState?: (next: Record<string, unknown>) => void;
  __recenterNordeste?: () => void;
  __zoomIn?: () => void;
  __zoomOut?: () => void;
};

/** Mapa interativo do Nordeste na Web usando iframe com a mesma engine Leaflet/IBGE do APK. */
export const NordesteLeafletMap: React.FC<NordesteLeafletMapProps> = ({
  selectedRegionName,
  gpsDetectedRegionId,
  gpsUserCoords,
  onSelectRegion,
  onFallbackOffline,
  theme,
}) => {
  const { language } = useAccessibility();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<'streets' | 'satellite'>('streets');
  const [showLabels, setShowLabels] = useState(true);

  const html = useMemo(() => buildNordesteLeafletHtml(), []);

  useEffect(() => {
    onSelectRef.current = onSelectRegion;
  }, [onSelectRegion]);

  const latestStateRef = useRef({
    selectedName: selectedRegionName,
    gpsRegionId: gpsDetectedRegionId ?? null,
    gpsCoords: gpsUserCoords ?? null,
    basemap,
    showLabels,
  });

  useEffect(() => {
    latestStateRef.current = {
      selectedName: selectedRegionName,
      gpsRegionId: gpsDetectedRegionId ?? null,
      gpsCoords: gpsUserCoords ?? null,
      basemap,
      showLabels,
    };
  }, [selectedRegionName, gpsDetectedRegionId, gpsUserCoords, basemap, showLabels]);

  const getFrameWin = (): LeafletIframeWindow | null =>
    (iframeRef.current?.contentWindow as LeafletIframeWindow | null) ?? null;

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as {
        source?: string;
        channel?: string;
        payload?: { type?: string; id?: string };
      } | null;
      if (!data || data.source !== 'rocaviva-leaflet' || data.channel !== 'nordeste') return;
      const msg = data.payload;
      if (!msg) return;
      if (msg.type === 'ready') {
        setMapReady(true);
        return;
      }
      if (msg.type === 'selectRegion' && msg.id) {
        const reg = NORDESTE_REGIONS.find((r) => r.id === msg.id);
        if (reg) onSelectRef.current(reg);
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    getFrameWin()?.__updateMapState?.({
      selectedName: selectedRegionName,
      gpsRegionId: gpsDetectedRegionId ?? null,
      gpsCoords: gpsUserCoords ?? null,
      basemap,
      showLabels,
      panToSelected: true,
    });
  }, [mapReady, selectedRegionName, gpsDetectedRegionId, gpsUserCoords, basemap, showLabels]);

  const handleIframeLoad = () => {
    setMapReady(true);
    getFrameWin()?.__updateMapState?.({
      ...latestStateRef.current,
      panToSelected: true,
    });
  };

  const selectedReg = NORDESTE_REGIONS.find((r) => r.nome === selectedRegionName);

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <iframe
        ref={iframeRef}
        title={pickLang(language, 'Interactive Northeast map', 'Mapa interativo do Nordeste')}
        srcDoc={html}
        onLoad={handleIframeLoad}
        onError={() => onFallbackOffline?.()}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          backgroundColor: '#DCEEF8',
        }}
      />

      <View pointerEvents="box-none" style={styles.hudTop}>
        <View style={[styles.hudGroup, { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: theme.border }]}>
          <Pressable
            onPress={() => setBasemap('streets')}
            style={[
              styles.hudBtn,
              basemap === 'streets' && { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons
              name="map-outline"
              size={13}
              color={basemap === 'streets' ? theme.primaryText : '#19221C'}
            />
            <Text
              style={[
                styles.hudBtnText,
                { color: basemap === 'streets' ? theme.primaryText : '#19221C' },
              ]}
            >
              {pickLang(language, 'Street Map', 'Cartográfico')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setBasemap('satellite')}
            style={[
              styles.hudBtn,
              basemap === 'satellite' && { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons
              name="planet-outline"
              size={13}
              color={basemap === 'satellite' ? theme.primaryText : '#19221C'}
            />
            <Text
              style={[
                styles.hudBtnText,
                { color: basemap === 'satellite' ? theme.primaryText : '#19221C' },
              ]}
            >
              {pickLang(language, 'Satellite', 'Satélite')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.hudRightActions}>
          <Pressable
            onPress={() => setShowLabels((v) => !v)}
            style={[
              styles.hudIconBtn,
              {
                backgroundColor: showLabels ? theme.primary : 'rgba(255,255,255,0.94)',
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="pricetag-outline"
              size={14}
              color={showLabels ? theme.primaryText : '#19221C'}
            />
          </Pressable>

          <Pressable
            onPress={() => getFrameWin()?.__recenterNordeste?.()}
            style={[
              styles.hudIconBtn,
              { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: theme.border },
            ]}
          >
            <Ionicons name="refresh" size={15} color="#19221C" />
          </Pressable>
        </View>
      </View>

      <View style={styles.zoomCol}>
        <Pressable
          onPress={() => getFrameWin()?.__zoomIn?.()}
          style={[styles.zoomBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="add" size={18} color="#19221C" />
        </Pressable>
        <Pressable
          onPress={() => getFrameWin()?.__zoomOut?.()}
          style={[styles.zoomBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="remove" size={18} color="#19221C" />
        </Pressable>
      </View>

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            {pickLang(
              language,
              'Loading interactive map (IBGE + Satellite)...',
              'Carregando mapa interativo (IBGE + Satélite)...'
            )}
          </Text>
        </View>
      )}

      <View style={styles.summaryBar}>
        <View style={[styles.summaryBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.summaryBadgeText, { color: theme.primaryText }]}>
            IBGE +{' '}
            {basemap === 'satellite'
              ? pickLang(language, 'Esri Satellite', 'Satélite Esri')
              : 'Esri/OSM'}
          </Text>
        </View>
        <Text style={styles.summaryText} numberOfLines={1}>
          {selectedReg
            ? pickLang(
                language,
                `${selectedReg.nome} (${selectedReg.estado}) · Dry spell risk ${selectedReg.riscoVeranicoPct}%`,
                `${selectedReg.nome} (${selectedReg.estado}) · Risco veranico ${selectedReg.riscoVeranicoPct}%`
              )
            : pickLang(
                language,
                '9 states · Tap a marker',
                '9 estados · Toque em um marcador'
              )}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 320,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(245,243,235,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hudTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  hudGroup: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1.2,
    padding: 3,
    gap: 3,
  },
  hudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },
  hudBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hudRightActions: {
    flexDirection: 'row',
    gap: 5,
  },
  hudIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCol: {
    position: 'absolute',
    right: 8,
    bottom: 38,
    zIndex: 30,
    gap: 4,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBar: {
    position: 'absolute',
    left: 8,
    right: 48,
    bottom: 8,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(25, 34, 28, 0.84)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  summaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  summaryBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
    flex: 1,
  },
});
