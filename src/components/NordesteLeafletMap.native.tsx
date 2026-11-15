import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { LEAFLET_CSS, LEAFLET_JS } from '../data/leafletInline';
import { NORDESTE_IBGE_GEOJSON } from '../data/nordesteIbgeGeo';
import { BahiaRegionPreset, NORDESTE_REGIONS } from '../data/seedData';
import { AppTheme } from '../theme/tokens';
import { GeoPoint } from '../types/domain';

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

function buildNordesteLeafletHtml(): string {
  const geoJsonStr = JSON.stringify(NORDESTE_IBGE_GEOJSON);
  const regionsPayload = JSON.stringify(
    NORDESTE_REGIONS.map((r) => ({
      id: r.id,
      nome: r.nome,
      municipio: r.municipio,
      estado: r.estado,
      bioma: r.bioma,
      lat: r.centroid.latitude,
      lon: r.centroid.longitude,
      risco: r.riscoVeranicoPct,
    }))
  );

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
  padding: 1px 4px !important;
}
.region-pill-icon {
  background: transparent;
  border: none;
}
.pill-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.95);
  border: 1.5px solid #2A704A;
  color: #163022;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,0.22);
  transform: translate(-50%, -120%);
}
.pill-wrap.is-selected {
  background: #1B6B40;
  color: #FFFFFF;
  border-color: #FFFFFF;
  transform: translate(-50%, -125%) scale(1.06);
  z-index: 999;
}
.pill-wrap.is-gps:not(.is-selected) {
  border-color: #1D6FA5;
  color: #0F4C75;
}
.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #D97706;
  flex-shrink: 0;
}
.pill-wrap.is-selected .pill-dot {
  background: #86EFAC;
}
.pill-wrap.is-gps .pill-dot {
  background: #0EA5E9;
}
.uf-label {
  background: transparent;
  border: none;
  font-size: 10px;
  font-weight: 900;
  color: rgba(25, 34, 28, 0.72);
  text-shadow: 0 1px 2px rgba(255,255,255,0.9);
  pointer-events: none;
}
.uf-label-sat {
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 3px rgba(0,0,0,0.85);
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
  var IBGE_GEO = ${geoJsonStr};
  var REGIONS = ${regionsPayload};
  var state = {
    selectedName: 'Recôncavo Baiano',
    gpsRegionId: null,
    gpsCoords: null,
    basemap: 'streets',
    showLabels: true
  };

  var map = L.map('map', {
    center: [-9.8, -40.8],
    zoom: 5,
    minZoom: 4,
    maxZoom: 14,
    zoomControl: false,
    attributionControl: true
  });

  var osmLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: 'OSM/Carto · IBGE'
  });

  var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Esri Satélite · IBGE'
  });

  var satLabelsLayer = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
  });

  osmLayer.addTo(map);

  var geoLayer = null;
  var markersLayer = L.layerGroup().addTo(map);
  var ufLabelsLayer = L.layerGroup().addTo(map);
  var gpsLayer = L.layerGroup().addTo(map);

  function getSelectedStateUf() {
    var found = REGIONS.find(function(r) { return r.nome === state.selectedName; });
    return found ? found.estado : null;
  }

  function styleStateFeature(feature) {
    var selectedUf = getSelectedStateUf();
    var isSelectedUf = feature.properties && feature.properties.uf === selectedUf;
    var isSat = state.basemap === 'satellite';
    return {
      color: isSelectedUf ? (isSat ? '#4ADE80' : '#1B6B40') : (isSat ? 'rgba(255,255,255,0.68)' : '#4A785E'),
      weight: isSelectedUf ? 2.6 : 1.25,
      opacity: 0.95,
      fillColor: isSelectedUf ? '#22C55E' : '#1B6B40',
      fillOpacity: isSelectedUf ? (isSat ? 0.22 : 0.16) : (isSat ? 0.04 : 0.06)
    };
  }

  function selectNearestRegionForUf(uf) {
    var match = REGIONS.find(function(r) { return r.estado === uf; });
    if (match && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectRegion', id: match.id }));
    }
  }

  geoLayer = L.geoJSON(IBGE_GEO, {
    style: styleStateFeature,
    onEachFeature: function(feature, layer) {
      layer.on('click', function() {
        if (feature.properties && feature.properties.uf) {
          selectNearestRegionForUf(feature.properties.uf);
        }
      });
      if (state.showLabels && feature.properties && feature.properties.uf) {
        try {
          var center = layer.getBounds().getCenter();
          L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: 'uf-label',
              html: '<span>' + feature.properties.uf + '</span>',
              iconSize: [24, 14],
              iconAnchor: [12, 7]
            })
          }).addTo(ufLabelsLayer);
        } catch (e) {}
      }
    }
  }).addTo(map);

  try {
    map.fitBounds(geoLayer.getBounds(), { padding: [14, 14] });
  } catch (e) {}

  function renderMarkers() {
    markersLayer.clearLayers();
    REGIONS.forEach(function(reg) {
      var isSel = reg.nome === state.selectedName;
      var isGps = reg.id === state.gpsRegionId;

      var circle = L.circleMarker([reg.lat, reg.lon], {
        radius: isSel ? 8 : 5.5,
        color: '#FFFFFF',
        weight: isSel ? 2.5 : 1.5,
        fillColor: isSel ? '#1B6B40' : (isGps ? '#0EA5E9' : '#D97706'),
        fillOpacity: 0.96
      });

      circle.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectRegion', id: reg.id }));
        }
      });
      circle.addTo(markersLayer);

      if (state.showLabels || isSel || isGps) {
        var shortTitle = reg.estado + ' · ' + reg.municipio.split('/')[0].trim();
        var pillMarker = L.marker([reg.lat, reg.lon], {
          icon: L.divIcon({
            className: 'region-pill-icon',
            html: '<div class="pill-wrap ' + (isSel ? 'is-selected' : '') + ' ' + (isGps ? 'is-gps' : '') + '"><span class="pill-dot"></span><span>' + shortTitle + '</span></div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })
        });
        pillMarker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectRegion', id: reg.id }));
          }
        });
        pillMarker.addTo(markersLayer);
      }
    });
  }

  function renderGpsPin() {
    gpsLayer.clearLayers();
    if (!state.gpsCoords) return;
    L.circle([state.gpsCoords.latitude, state.gpsCoords.longitude], {
      radius: 42000,
      color: '#0284C7',
      weight: 1.5,
      fillColor: '#38BDF8',
      fillOpacity: 0.2
    }).addTo(gpsLayer);
    L.circleMarker([state.gpsCoords.latitude, state.gpsCoords.longitude], {
      radius: 6,
      color: '#FFFFFF',
      weight: 2,
      fillColor: '#0284C7',
      fillOpacity: 1
    }).addTo(gpsLayer);
  }

  window.__updateMapState = function(next) {
    var prevBasemap = state.basemap;
    var prevSelected = state.selectedName;
    if (next.selectedName !== undefined) state.selectedName = next.selectedName;
    if (next.gpsRegionId !== undefined) state.gpsRegionId = next.gpsRegionId;
    if (next.gpsCoords !== undefined) state.gpsCoords = next.gpsCoords;
    if (next.basemap !== undefined) state.basemap = next.basemap;
    if (next.showLabels !== undefined) state.showLabels = next.showLabels;

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

    if (geoLayer) geoLayer.setStyle(styleStateFeature);
    renderMarkers();
    renderGpsPin();

    if (next.focusSelected || (prevSelected !== state.selectedName && next.panToSelected)) {
      var target = REGIONS.find(function(r) { return r.nome === state.selectedName; });
      if (target) {
        map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 6), { duration: 0.45 });
      }
    }
  };

  window.__recenterNordeste = function() {
    try {
      map.fitBounds(geoLayer.getBounds(), { padding: [14, 14] });
    } catch (e) {}
  };

  window.__zoomIn = function() { map.zoomIn(); };
  window.__zoomOut = function() { map.zoomOut(); };

  renderMarkers();
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
})();
</script>
</body>
</html>`;
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
      {/* Floating HUD estilo FullstackAV3: Cartográfico / Satélite + Rótulos + Recentralizar */}
      <View style={styles.hudTop}>
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
      <View style={styles.zoomCol}>
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

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Carregando mapa interativo (IBGE + Satélite)...
          </Text>
        </View>
      )}

      {/* Barra inferior de resumo contextual estilo FullstackAV3 */}
      <View style={styles.summaryBar}>
        <View style={[styles.summaryBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.summaryBadgeText, { color: theme.primaryText }]}>
            IBGE + {basemap === 'satellite' ? 'Satélite Esri' : 'OSM'}
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
