import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { AppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';
import { buildNordesteLeafletHtml } from '../utils/leafletHtml';

type WebViewHandle = { injectJavaScript: (script: string) => void };
const LeafletWebView = WebView as unknown as React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewHandle>
>;

export interface NordesteLeafletMapProps {
  selectedRegionName: string;
  gpsDetectedRegionId?: string | null;
  gpsUserCoords?: GeoPoint | null;
  onSelectRegion: (region: BahiaRegionPreset) => void;
  onFallbackOffline?: () => void;
  theme: AppTheme;
}

export const NordesteLeafletMap: React.FC<NordesteLeafletMapProps> = ({
  selectedRegionName,
  gpsDetectedRegionId,
  gpsUserCoords,
  onSelectRegion,
  onFallbackOffline,
  theme,
}) => {
  const webViewRef = useRef<WebViewHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<'streets' | 'satellite'>('streets');
  const [showLabels, setShowLabels] = useState(true);

  const html = useMemo(() => buildNordesteLeafletHtml(), []);

  useEffect(() => {
    if (!mapReady) return;
    const payload = JSON.stringify({
      selectedName: selectedRegionName,
      gpsRegionId: gpsDetectedRegionId ?? null,
      gpsCoords: gpsUserCoords ?? null,
      basemap,
      showLabels,
      panToSelected: true,
    });
    webViewRef.current?.injectJavaScript(`window.__updateMapState && window.__updateMapState(${payload}); true;`);
  }, [mapReady, selectedRegionName, gpsDetectedRegionId, gpsUserCoords, basemap, showLabels]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; id?: string };
      if (msg.type === 'ready') {
        setMapReady(true);
        return;
      }
      if (msg.type === 'selectRegion' && msg.id) {
        const reg = NORDESTE_REGIONS.find((r) => r.id === msg.id);
        if (reg) onSelectRegion(reg);
      }
    } catch {
      // Ignora mensagens inválidas
    }
  };

  const selectedReg = NORDESTE_REGIONS.find((r) => r.nome === selectedRegionName);

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <LeafletWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://rocaviva.app/' }}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        androidLayerType="hardware"
        onMessage={handleMessage}
        onError={() => onFallbackOffline?.()}
        style={styles.webview}
      />

      {/* Floating HUD estilo FullstackAV3: Cartográfico / Satélite + Rótulos + Recentralizar */}
      <View pointerEvents="box-none" style={[styles.hudTop, { elevation: 10 }]}>
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
              Cartográfico
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
              Satélite
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
            onPress={() =>
              webViewRef.current?.injectJavaScript('window.__recenterNordeste && window.__recenterNordeste(); true;')
            }
            style={[
              styles.hudIconBtn,
              { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: theme.border },
            ]}
          >
            <Ionicons name="refresh" size={15} color="#19221C" />
          </Pressable>
        </View>
      </View>

      {/* Botões de zoom no canto direito */}
      <View style={[styles.zoomCol, { elevation: 10 }]}>
        <Pressable
          onPress={() =>
            webViewRef.current?.injectJavaScript('window.__zoomIn && window.__zoomIn(); true;')
          }
          style={[styles.zoomBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="add" size={18} color="#19221C" />
        </Pressable>
        <Pressable
          onPress={() =>
            webViewRef.current?.injectJavaScript('window.__zoomOut && window.__zoomOut(); true;')
          }
          style={[styles.zoomBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="remove" size={18} color="#19221C" />
        </Pressable>
      </View>

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Carregando mapa interativo (IBGE + Satélite)...
          </Text>
        </View>
      )}

      {/* Barra inferior de resumo contextual estilo FullstackAV3 */}
      <View style={[styles.summaryBar, { elevation: 10 }]}>
        <View style={[styles.summaryBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.summaryBadgeText, { color: theme.primaryText }]}>
            IBGE + {basemap === 'satellite' ? 'Satélite Esri' : 'Esri/OSM'}
          </Text>
        </View>
        <Text style={styles.summaryText} numberOfLines={1}>
          {selectedReg
            ? `${selectedReg.nome} (${selectedReg.estado}) · Risco veranico ${selectedReg.riscoVeranicoPct}%`
            : '9 estados · Toque em um marcador'}
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
  webview: {
    flex: 1,
    backgroundColor: '#DCEEF8',
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
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    pointerEvents: 'box-none',
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
    zIndex: 20,
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
    zIndex: 20,
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
