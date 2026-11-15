import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapPressEvent, Marker, Polygon } from 'react-native-maps';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { useAccessibility } from '../context/AccessibilityContext';
import { LEAFLET_CSS, LEAFLET_JS } from '../data/leafletInline';
import {
  FarmMapCanvas as VectorFallbackCanvas,
  FarmMapCanvasProps,
} from './FarmMapCanvas';

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

function buildFarmLeafletHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
${LEAFLET_CSS}
html, body, #map {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: #DCEEF8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}
.leaflet-control-attribution {
  font-size: 9px !important;
  background: rgba(255,255,255,0.78) !important;
}
</style>
</head>
<body>
<div id="map"></div>
<script>
${LEAFLET_JS}
</script>
<script>
(function() {
  var state = {
    centroid: { latitude: -12.9714, longitude: -38.5014 },
    polygon: [],
    wells: [],
    showWells: true,
    drawingMode: false,
    basemap: 'satellite'
  };

  var map = L.map('map', {
    center: [-12.9714, -38.5014],
    zoom: 16,
    minZoom: 5,
    maxZoom: 19,
    zoomControl: false
  });

  var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Esri Satélite'
  });
  var satLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  });
  var osmLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: 'OSM/Carto'
  });

  satLayer.addTo(map);
  satLabelsLayer.addTo(map);

  var polyLayer = L.layerGroup().addTo(map);
  var wellsLayer = L.layerGroup().addTo(map);

  map.on('click', function(e) {
    if (!state.drawingMode) return;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'addPoint',
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6))
      }));
    }
  });

  function renderOverlays(shouldFit) {
    polyLayer.clearLayers();
    wellsLayer.clearLayers();

    if (state.polygon && state.polygon.length >= 3) {
      var latlngs = state.polygon.map(function(p) { return [p.latitude, p.longitude]; });
      var poly = L.polygon(latlngs, {
        color: '#22C55E',
        weight: 3,
        fillColor: '#1B6B40',
        fillOpacity: 0.34
      }).addTo(polyLayer);
      if (shouldFit && !state.drawingMode) {
        try {
          if (state.showWells && state.wells.length > 0) {
            map.setView([state.centroid.latitude, state.centroid.longitude], 12);
          } else {
            map.fitBounds(poly.getBounds(), { padding: [24, 24], maxZoom: 17 });
          }
        } catch (e) {}
      }
    } else if (shouldFit) {
      map.setView([state.centroid.latitude, state.centroid.longitude], state.showWells ? 12 : 16);
    }

    (state.polygon || []).forEach(function(pt, idx) {
      L.circleMarker([pt.latitude, pt.longitude], {
        radius: 5.5,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#16A34A',
        fillOpacity: 1
      }).bindTooltip('Ponto ' + (idx + 1)).addTo(polyLayer);
    });

    if (state.showWells) {
      (state.wells || []).forEach(function(w) {
        var fill = w.salinidade === 'doce' ? '#0EA5E9' : (w.salinidade === 'salobra' ? '#F59E0B' : '#EF4444');
        L.circle([w.latitude, w.longitude], {
          radius: 1400,
          color: fill,
          weight: 1.2,
          fillColor: fill,
          fillOpacity: 0.16
        }).addTo(wellsLayer);
        L.circleMarker([w.latitude, w.longitude], {
          radius: 6,
          color: '#FFFFFF',
          weight: 1.8,
          fillColor: fill,
          fillOpacity: 0.95
        }).bindPopup(
          '<strong>' + w.codigoSiagas + '</strong><br/>' +
          w.profundidadeM + ' m · ' + w.vazaoLph + ' L/h<br/>' +
          'Água: ' + w.salinidade + ' (' + w.sucessoHistoricoPct + '% sucesso)'
        ).addTo(wellsLayer);
      });
    }
  }

  window.__updateFarmMap = function(next) {
    var prevBasemap = state.basemap;
    var prevCentroid = state.centroid;
    var prevShowWells = state.showWells;
    state = Object.assign({}, state, next);

    if (prevBasemap !== state.basemap) {
      if (state.basemap === 'satellite') {
        map.removeLayer(osmLayer);
        satLayer.addTo(map);
        satLabelsLayer.addTo(map);
      } else {
        map.removeLayer(satLayer);
        map.removeLayer(satLabelsLayer);
        osmLayer.addTo(map);
      }
    }

    var moved =
      Math.abs((prevCentroid.latitude || 0) - state.centroid.latitude) > 0.01 ||
      Math.abs((prevCentroid.longitude || 0) - state.centroid.longitude) > 0.01 ||
      prevShowWells !== state.showWells;
    renderOverlays(moved || Boolean(next.forceFit));
  };

  window.__recenterFarm = function() {
    renderOverlays(true);
  };

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
})();
</script>
</body>
</html>`;
}

const LeafletFarmCanvas: React.FC<FarmMapCanvasProps & { onFallbackOffline: () => void }> = ({
  centroid,
  polygon,
  wells,
  showWells,
  drawingMode,
  onAddPoint,
  onFallbackOffline,
  theme,
}) => {
  const webViewRef = useRef<WebViewHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<'satellite' | 'streets'>('satellite');
  const html = useMemo(() => buildFarmLeafletHtml(), []);

  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify({
      centroid,
      polygon,
      wells,
      showWells,
      drawingMode,
      basemap,
    });
    webViewRef.current?.injectJavaScript(`window.__updateFarmMap && window.__updateFarmMap(${payload}); true;`);
  }, [ready, centroid, polygon, wells, showWells, drawingMode, basemap]);

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
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <View style={styles.hudRow}>
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

        <Pressable
          onPress={() =>
            webViewRef.current?.injectJavaScript('window.__recenterFarm && window.__recenterFarm(); true;')
          }
          style={[styles.recenterBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="locate" size={14} color="#19221C" />
        </Pressable>
      </View>

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

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {drawingMode
            ? 'Toque no satélite para demarcar cantos da roça'
            : showWells
            ? 'Satélite + Poços (SIAGAS + GRACE-FO)'
            : 'Talhão em Satélite (Esri/OSM)'}
        </Text>
      </View>
    </View>
  );
};

export const FarmMapCanvas: React.FC<FarmMapCanvasProps> = (props) => {
  const { isOnline } = useAccessibility();
  const [forceVectorOffline, setForceVectorOffline] = useState(false);
  const { centroid, polygon, wells, showWells, drawingMode, onAddPoint, theme } = props;
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
      <View style={[styles.wrap, { borderColor: theme.border }]}>
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
              coordinates={polygon}
              fillColor="rgba(31, 110, 67, 0.34)"
              strokeColor="#22C55E"
              strokeWidth={3}
            />
          )}

          {polygon.map((pt, idx) => (
            <Marker
              key={`${idx}-${pt.latitude}`}
              coordinate={pt}
              title={`Ponto ${idx + 1}`}
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
                    description={`Água ${w.salinidade} • ${w.vazaoLph} L/h • Sucesso ${w.sucessoHistoricoPct}%`}
                    pinColor={w.salinidade === 'doce' ? 'blue' : 'orange'}
                  />
                </React.Fragment>
              );
            })}
        </MapView>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {drawingMode
              ? 'Toque no mapa para demarcar vértices'
              : showWells
              ? 'Heatmap de Poços (SIAGAS + GRACE-FO)'
              : 'Nordeste • Mapa Nativo'}
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
