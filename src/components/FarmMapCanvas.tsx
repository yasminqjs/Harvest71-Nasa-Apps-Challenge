import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import { useLanguage } from '../i18n/Language';
import { useAccessibility } from '../context/AccessibilityContext';
import { buildFarmLeafletHtml } from '../utils/leafletHtml';
import { FarmMapCanvasProps, VectorFarmCanvas } from './VectorFarmCanvas';

export type { FarmMapCanvasProps } from './VectorFarmCanvas';

type FarmIframeWindow = Window & {
  __updateFarmMap?: (next: Record<string, unknown>) => void;
  __recenterFarm?: () => void;
};

const LeafletFarmWebCanvas: React.FC<
  FarmMapCanvasProps & { onFallbackOffline: () => void }
> = ({
  centroid,
  polygon,
  lots = [],
  activeLotId,
  wells = [],
  showWells,
  drawingMode,
  height = 280,
  onAddPoint,
  onFallbackOffline,
  theme,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onAddPointRef = useRef(onAddPoint);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<'satellite' | 'streets'>('satellite');
  const { language } = useLanguage();
  const [html] = useState(() => buildFarmLeafletHtml(language));

  useEffect(() => {
    onAddPointRef.current = onAddPoint;
  }, [onAddPoint]);

  const latestStateRef = useRef({
    centroid,
    polygon,
    lots,
    activeLotId,
    wells,
    showWells,
    drawingMode,
    basemap,
    language,
  });

  useEffect(() => {
    latestStateRef.current = {
      centroid,
      polygon,
      lots,
      activeLotId,
      wells,
      showWells,
      drawingMode,
      basemap,
      language,
    };
  }, [centroid, polygon, lots, activeLotId, wells, showWells, drawingMode, basemap, language]);

  const getFrameWin = (): FarmIframeWindow | null =>
    (iframeRef.current?.contentWindow as FarmIframeWindow | null) ?? null;

  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as {
        source?: string;
        channel?: string;
        payload?: { type?: string; latitude?: number; longitude?: number };
      } | null;
      if (!data || data.source !== 'rocaviva-leaflet' || data.channel !== 'farm') return;
      const msg = data.payload;
      if (!msg) return;
      if (msg.type === 'ready') {
        setReady(true);
        return;
      }
      if (msg.type === 'addPoint' && msg.latitude !== undefined && msg.longitude !== undefined) {
        onAddPointRef.current({ latitude: msg.latitude, longitude: msg.longitude });
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    getFrameWin()?.__updateFarmMap?.({
      centroid,
      polygon,
      lots,
      activeLotId,
      wells,
      showWells,
      drawingMode,
      basemap,
      language,
      forceFit: false,
    });
  }, [ready, centroid, polygon, lots, activeLotId, wells, showWells, drawingMode, basemap, language]);

  const handleIframeLoad = () => {
    setReady(true);
    getFrameWin()?.__updateFarmMap?.({
      ...latestStateRef.current,
      forceFit: true,
    });
  };

  return (
    <View style={[styles.wrap, { height, borderColor: theme.border }]}>
      <iframe
        ref={iframeRef}
        title={language === 'en' ? 'Interactive farm map' : 'Mapa interativo da roça'}
        srcDoc={html}
        onLoad={handleIframeLoad}
        onError={onFallbackOffline}
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

      <View pointerEvents="box-none" style={styles.hudRow}>
        <View style={[styles.hudGroup, { borderColor: theme.border }]}>
          <Pressable
            onPress={() => setBasemap('satellite')}
            style={[styles.hudBtn, basemap === 'satellite' && { backgroundColor: theme.primary }]}
          >
            <Ionicons
              name="planet-outline"
              size={12}
              color={basemap === 'satellite' ? theme.primaryText : '#19221C'}
            />
            <Text
              style={[
                styles.hudText,
                { color: basemap === 'satellite' ? theme.primaryText : '#19221C' },
              ]}
            >
              Satélite
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBasemap('streets')}
            style={[styles.hudBtn, basemap === 'streets' && { backgroundColor: theme.primary }]}
          >
            <Ionicons
              name="map-outline"
              size={12}
              color={basemap === 'streets' ? theme.primaryText : '#19221C'}
            />
            <Text
              style={[
                styles.hudText,
                { color: basemap === 'streets' ? theme.primaryText : '#19221C' },
              ]}
            >
              Cartográfico
            </Text>
          </Pressable>
        </View>

        <View style={styles.rightActions}>
          <Pressable
            onPress={onFallbackOffline}
            style={[styles.offlineBtn, { borderColor: theme.border }]}
          >
            <Ionicons name="grid-outline" size={12} color="#19221C" />
            <Text style={styles.offlineBtnText}>Offline</Text>
          </Pressable>

          <Pressable
            onPress={() => getFrameWin()?.__recenterFarm?.()}
            style={[styles.recenterBtn, { borderColor: theme.border }]}
          >
            <Ionicons name="locate" size={14} color="#19221C" />
          </Pressable>
        </View>
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {drawingMode
            ? 'Toque no mapa para demarcar os cantos'
            : showWells
            ? `${basemap === 'streets' ? 'Cartográfico' : 'Satélite'} + Poços (SIAGAS)`
            : basemap === 'streets'
            ? 'Mapa Cartográfico (Esri/OSM)'
            : 'Satélite da Roça (Esri)'}
        </Text>
      </View>
    </View>
  );
};

/** Mapa da propriedade na Web com Leaflet (Satélite/Cartográfico) e fallback vetorial offline. */
export const FarmMapCanvas: React.FC<FarmMapCanvasProps> = (props) => {
  const { isOnline } = useAccessibility();
  const [forceVectorOffline, setForceVectorOffline] = useState(false);

  if (isOnline && !forceVectorOffline) {
    return (
      <LeafletFarmWebCanvas
        {...props}
        onFallbackOffline={() => setForceVectorOffline(true)}
      />
    );
  }

  return (
    <View style={{ gap: 6 }}>
      {isOnline && forceVectorOffline && (
        <Pressable
          onPress={() => setForceVectorOffline(false)}
          style={[
            styles.backOnlineBtn,
            { backgroundColor: props.theme.surfaceMuted, borderColor: props.theme.border },
          ]}
        >
          <Ionicons name="planet-outline" size={14} color={props.theme.primary} />
          <Text style={[styles.backOnlineText, { color: props.theme.text }]}>
            Voltar para Satélite / Cartográfico (Online)
          </Text>
        </Pressable>
      )}
      <VectorFarmCanvas {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 280,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  hudRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    borderWidth: 1.2,
    padding: 2,
    gap: 2,
  },
  hudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hudText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.2,
  },
  offlineBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#19221C',
  },
  recenterBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    zIndex: 30,
    backgroundColor: 'rgba(25, 34, 28, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  backOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  backOnlineText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
