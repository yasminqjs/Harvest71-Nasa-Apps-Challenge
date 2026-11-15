import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapPressEvent, Marker, Polygon } from 'react-native-maps';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { useAccessibility } from '../context/AccessibilityContext';
import { pickLang } from '../i18n/locale';
import { sortPolygonPoints } from '../utils/geoprocessing';
import { buildFarmLeafletHtml } from '../utils/leafletHtml';
import {
  FarmMapCanvasProps,
  VectorFarmCanvas as VectorFallbackCanvas,
} from './VectorFarmCanvas';

type WebViewHandle = { injectJavaScript: (script: string) => void };
const LeafletWebView = WebView as unknown as React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewHandle>
>;

class MapErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const LeafletFarmCanvas: React.FC<FarmMapCanvasProps & { onFallbackOffline: () => void }> = ({
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
  const { language } = useAccessibility();
  const webViewRef = useRef<WebViewHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<'satellite' | 'streets'>('satellite');
  const html = useMemo(() => buildFarmLeafletHtml(language), [language]);

  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify({
      centroid,
      polygon,
      lots,
      activeLotId,
      wells,
      showWells,
      drawingMode,
      basemap,
    });
    webViewRef.current?.injectJavaScript(`window.__updateFarmMap && window.__updateFarmMap(${payload}); true;`);
  }, [ready, centroid, polygon, lots, activeLotId, wells, showWells, drawingMode, basemap]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        latitude?: number;
        longitude?: number;
      };
      if (msg.type === 'ready') {
        setReady(true);
        webViewRef.current?.injectJavaScript(
          `window.__updateFarmMap && window.__updateFarmMap(${JSON.stringify({
            centroid,
            polygon,
            lots,
            activeLotId,
            wells,
            showWells,
            drawingMode,
            basemap,
            forceFit: true,
          })}); true;`
        );
        return;
      }
      if (msg.type === 'addPoint' && msg.latitude !== undefined && msg.longitude !== undefined) {
        onAddPoint({ latitude: msg.latitude, longitude: msg.longitude });
      }
    } catch {
      // Ignora mensagem malformada
    }
  };

  return (
    <View style={[styles.wrap, { height, borderColor: theme.border }]}>
      <LeafletWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://rocaviva.app/' }}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        androidLayerType="hardware"
        onMessage={handleMessage}
        onError={onFallbackOffline}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" style={[styles.hudRow, { elevation: 10 }]}>
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
              {pickLang(language, 'Satellite', 'Satélite')}
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
              {pickLang(language, 'Street Map', 'Cartográfico')}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() =>
            webViewRef.current?.injectJavaScript('window.__recenterFarm && window.__recenterFarm(); true;')
          }
          style={[styles.recenterBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="locate" size={14} color="#19221C" />
        </Pressable>
      </View>

      <View style={[styles.badge, { elevation: 10 }]}>
        <Text style={styles.badgeText}>
          {drawingMode
            ? pickLang(
                language,
                'Tap on the map to mark corners',
                'Toque no mapa para demarcar os cantos'
              )
            : showWells
            ? `${
                basemap === 'streets'
                  ? pickLang(language, 'Street Map', 'Cartográfico')
                  : pickLang(language, 'Satellite', 'Satélite')
              } + ${pickLang(language, 'Wells (SIAGAS)', 'Poços (SIAGAS)')}`
            : basemap === 'streets'
            ? pickLang(language, 'Street Map (Esri/OSM)', 'Mapa Cartográfico (Esri/OSM)')
            : pickLang(language, 'Farm Satellite (Esri)', 'Satélite da Roça (Esri)')}
        </Text>
      </View>
    </View>
  );
};

export const FarmMapCanvas: React.FC<FarmMapCanvasProps> = (props) => {
  const { isOnline, language } = useAccessibility();
  const [forceVectorOffline, setForceVectorOffline] = useState(false);
  const {
    centroid,
    polygon,
    lots = [],
    activeLotId,
    wells = [],
    showWells,
    drawingMode,
    height = 280,
    onAddPoint,
    theme,
  } = props;
  const delta = showWells ? 0.14 : 0.0045;
  const hasGoogleMapsKey = Boolean(
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey
  );

  // Sem API key do Google Maps: usa Leaflet Satélite/Cartográfico online e cai para o canvas vetorial offline
  if (!hasGoogleMapsKey) {
    if (isOnline && !forceVectorOffline) {
      return (
        <LeafletFarmCanvas
          {...props}
          onFallbackOffline={() => setForceVectorOffline(true)}
        />
      );
    }
    return <VectorFallbackCanvas {...props} />;
  }

  const handleMapPress = (event: MapPressEvent) => {
    if (!drawingMode) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onAddPoint({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  };

  return (
    <MapErrorBoundary fallback={<VectorFallbackCanvas {...props} />}>
      <View style={[styles.wrap, { height, borderColor: theme.border }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          mapType="hybrid"
          region={{
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            latitudeDelta: delta,
            longitudeDelta: delta,
          }}
          onPress={handleMapPress}
        >
          {polygon.length >= 3 && (
            <Polygon
              coordinates={sortPolygonPoints(polygon)}
              fillColor="rgba(31, 110, 67, 0.24)"
              strokeColor="#22C55E"
              strokeWidth={3}
            />
          )}

          {lots.map((lot) =>
            lot.polygon.length >= 3 ? (
              <Polygon
                key={lot.id}
                coordinates={sortPolygonPoints(lot.polygon)}
                fillColor={`${lot.corHex}44`}
                strokeColor={lot.corHex}
                strokeWidth={lot.id === activeLotId ? 3.5 : 2.5}
              />
            ) : null
          )}

          {activeLotId &&
            lots
              .filter((lot) => lot.id === activeLotId)
              .flatMap((lot) =>
                lot.polygon.map((pt, idx) => (
                  <Marker
                    key={`${lot.id}-pt-${idx}-${pt.latitude}`}
                    coordinate={pt}
                    title={`${lot.nome} • ${pickLang(language, 'Point', 'Ponto')} ${idx + 1}`}
                    pinColor={lot.corHex}
                  />
                ))
              )}

          {!activeLotId &&
            polygon.map((pt, idx) => (
              <Marker
                key={`${idx}-${pt.latitude}`}
                coordinate={pt}
                title={`${pickLang(language, 'Point', 'Ponto')} ${idx + 1}`}
                pinColor="#16A34A"
              />
            ))}

          {showWells &&
            wells.map((w) => {
              const color =
                w.salinidade === 'doce'
                  ? 'rgba(14, 165, 233, 0.35)'
                  : w.salinidade === 'salobra'
                  ? 'rgba(245, 158, 11, 0.35)'
                  : 'rgba(239, 68, 68, 0.35)';
              return (
                <React.Fragment key={w.id}>
                  <Circle
                    center={{ latitude: w.latitude, longitude: w.longitude }}
                    radius={1800}
                    fillColor={color}
                    strokeColor="rgba(255,255,255,0.6)"
                  />
                  <Marker
                    coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                    title={`${w.codigoSiagas} • ${w.profundidadeM}m`}
                    description={`${pickLang(language, 'Water', 'Água')} ${w.salinidade} • ${w.vazaoLph} L/h • ${pickLang(language, 'Success', 'Sucesso')} ${w.sucessoHistoricoPct}%`}
                    pinColor={w.salinidade === 'doce' ? 'blue' : 'orange'}
                  />
                </React.Fragment>
              );
            })}
        </MapView>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {drawingMode
              ? pickLang(
                  language,
                  'Tap map to mark vertices',
                  'Toque no mapa para demarcar vértices'
                )
              : showWells
              ? pickLang(
                  language,
                  'Wells Heatmap (SIAGAS + GRACE-FO)',
                  'Heatmap de Poços (SIAGAS + GRACE-FO)'
                )
              : pickLang(
                  language,
                  'Northeast • Native Map',
                  'Nordeste • Mapa Nativo'
                )}
          </Text>
        </View>
      </View>
    </MapErrorBoundary>
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
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'box-none',
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
    zIndex: 20,
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
});
