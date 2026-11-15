import { LEAFLET_CSS, LEAFLET_JS } from '../data/leafletInline';
import { NORDESTE_IBGE_GEOJSON } from '../data/nordesteIbgeGeo';
import { NORDESTE_REGIONS } from '../data/seedData';

const HOST_EMITTER_HELPER = `
  function emitHostMessage(channel, payload) {
    try {
      var json = JSON.stringify(payload);
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(json);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'rocaviva-leaflet', channel: channel, payload: payload }, '*');
      }
    } catch (e) {}
  }
`;

export function buildNordesteLeafletHtml(): string {
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
  cursor: pointer;
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
${HOST_EMITTER_HELPER}
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

  var osmLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Esri Ruas · IBGE'
  });

  var osmFallbackApplied = false;
  osmLayer.on('tileerror', function() {
    if (osmFallbackApplied) return;
    osmFallbackApplied = true;
    osmLayer.setUrl('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png');
  });

  var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Esri Satélite · IBGE'
  });

  var satLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
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
    if (match) {
      emitHostMessage('nordeste', { type: 'selectRegion', id: match.id });
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
        emitHostMessage('nordeste', { type: 'selectRegion', id: reg.id });
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
          emitHostMessage('nordeste', { type: 'selectRegion', id: reg.id });
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
    var prevSelected = state.selectedName;
    if (next.selectedName !== undefined) state.selectedName = next.selectedName;
    if (next.gpsRegionId !== undefined) state.gpsRegionId = next.gpsRegionId;
    if (next.gpsCoords !== undefined) state.gpsCoords = next.gpsCoords;
    if (next.basemap !== undefined) state.basemap = next.basemap;
    if (next.showLabels !== undefined) state.showLabels = next.showLabels;

    if (state.basemap === 'satellite') {
      if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
      if (!map.hasLayer(satLayer)) satLayer.addTo(map);
      if (!map.hasLayer(satLabelsLayer)) satLabelsLayer.addTo(map);
    } else {
      if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
      if (map.hasLayer(satLabelsLayer)) map.removeLayer(satLabelsLayer);
      if (!map.hasLayer(osmLayer)) osmLayer.addTo(map);
      if (osmLayer.bringToBack) osmLayer.bringToBack();
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
  emitHostMessage('nordeste', { type: 'ready' });
})();
</script>
</body>
</html>`;
}

export function buildFarmLeafletHtml(): string {
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
.lot-sat-pill {
  background: rgba(17, 24, 39, 0.88);
  color: #FFFFFF;
  border: 2px solid #FFFFFF;
  border-radius: 10px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
  white-space: nowrap;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  cursor: pointer;
  transform: translate(-50%, -50%);
}
.lot-sat-pill-active {
  background: rgba(15, 23, 42, 0.96);
  border-color: #FDE047;
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.45), 0 4px 10px rgba(0,0,0,0.55);
}
.lot-sat-sub {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #A7F3D0;
  margin-top: 1px;
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
${HOST_EMITTER_HELPER}
  var state = {
    centroid: { latitude: -11.346531, longitude: -41.960674 },
    polygon: [],
    lots: [],
    activeLotId: null,
    wells: [],
    showWells: false,
    drawingMode: false,
    basemap: 'satellite'
  };

  var map = L.map('map', {
    center: [-11.346531, -41.960674],
    zoom: 16,
    minZoom: 5,
    maxZoom: 19,
    zoomControl: false
  });

  var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Esri Satélite'
  });
  var satLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
  });
  var osmLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Esri Ruas'
  });

  var farmOsmFallbackApplied = false;
  osmLayer.on('tileerror', function() {
    if (farmOsmFallbackApplied) return;
    farmOsmFallbackApplied = true;
    osmLayer.setUrl('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png');
  });

  satLayer.addTo(map);
  satLabelsLayer.addTo(map);

  var polyLayer = L.layerGroup().addTo(map);
  var lotsLayer = L.layerGroup().addTo(map);
  var wellsLayer = L.layerGroup().addTo(map);
  var hasFittedInitialView = false;

  map.on('click', function(e) {
    if (!state.drawingMode) return;
    emitHostMessage('farm', {
      type: 'addPoint',
      latitude: Number(e.latlng.lat.toFixed(6)),
      longitude: Number(e.latlng.lng.toFixed(6))
    });
  });

  function sortPolygonVertices(points) {
    if (!points || points.length < 3) return points || [];
    var avgLat = 0;
    var avgLon = 0;
    for (var i = 0; i < points.length; i++) {
      avgLat += points[i].latitude;
      avgLon += points[i].longitude;
    }
    avgLat /= points.length;
    avgLon /= points.length;
    return points.slice().sort(function(a, b) {
      var angA = Math.atan2(a.latitude - avgLat, a.longitude - avgLon);
      var angB = Math.atan2(b.latitude - avgLat, b.longitude - avgLon);
      return angB - angA;
    });
  }

  function renderOverlays(shouldFit) {
    polyLayer.clearLayers();
    lotsLayer.clearLayers();
    wellsLayer.clearLayers();

    if (state.polygon && state.polygon.length >= 3) {
      var ordered = sortPolygonVertices(state.polygon);
      var latlngs = ordered.map(function(p) { return [p.latitude, p.longitude]; });
      var poly = L.polygon(latlngs, {
        color: '#22C55E',
        weight: 3,
        fillColor: '#1B6B40',
        fillOpacity: 0.24
      }).addTo(polyLayer);
      if (shouldFit) {
        try {
          if (state.showWells && state.wells && state.wells.length > 0) {
            map.setView([state.centroid.latitude, state.centroid.longitude], 12, { animate: false });
          } else {
            map.fitBounds(poly.getBounds(), { padding: [24, 24], maxZoom: 17, animate: false });
          }
        } catch (e) {
          map.setView([state.centroid.latitude, state.centroid.longitude], 16, { animate: false });
        }
      }
    } else if (shouldFit) {
      map.setView([state.centroid.latitude, state.centroid.longitude], state.showWells ? 12 : 16, { animate: false });
    }

    (state.lots || []).forEach(function(lot) {
      var isActive = state.activeLotId && lot.id === state.activeLotId;
      var lotPts = lot.polygon || [];
      if (lotPts.length >= 3) {
        var orderedLot = sortPolygonVertices(lotPts);
        var lotLatLngs = orderedLot.map(function(p) { return [p.latitude, p.longitude]; });
        var lotPoly = L.polygon(lotLatLngs, {
          color: lot.corHex || '#2563EB',
          weight: isActive ? 3.5 : 2.5,
          dashArray: isActive ? null : '5,4',
          fillColor: lot.corHex || '#2563EB',
          fillOpacity: isActive ? 0.45 : 0.28
        }).bindTooltip((lot.nome || 'Lote') + (lot.culturaAtual ? ' • ' + lot.culturaAtual : ''), { sticky: true }).addTo(lotsLayer);

        lotPoly.on('click', function(ev) {
          if (state.drawingMode) return;
          if (ev && ev.originalEvent && ev.originalEvent.stopPropagation) {
            ev.originalEvent.stopPropagation();
          }
          emitHostMessage('farm', { type: 'selectLot', lotId: lot.id });
        });

        var cLat = 0;
        var cLon = 0;
        for (var j = 0; j < orderedLot.length; j++) {
          cLat += orderedLot[j].latitude;
          cLon += orderedLot[j].longitude;
        }
        cLat /= orderedLot.length;
        cLon /= orderedLot.length;

        var titleText = lot.culturaAtual
          ? (lot.nome + ' • ' + lot.culturaAtual)
          : (lot.nome || 'Lote');
        var badgeHtml =
          '<div class="lot-sat-pill ' + (isActive ? 'lot-sat-pill-active' : '') + '" style="border-left: 5px solid ' + (lot.corHex || '#2563EB') + ';">' +
            '<span>' + titleText + '</span>' +
            (lot.previsaoBadge ? '<span class="lot-sat-sub">' + lot.previsaoBadge + '</span>' : '') +
          '</div>';
        var pillMarker = L.marker([cLat, cLon], {
          icon: L.divIcon({
            className: '',
            html: badgeHtml,
            iconSize: [0, 0]
          })
        }).addTo(lotsLayer);

        pillMarker.on('click', function() {
          if (state.drawingMode) return;
          emitHostMessage('farm', { type: 'selectLot', lotId: lot.id });
        });
      } else if (isActive && lotPts.length === 2) {
        L.polyline(
          lotPts.map(function(p) { return [p.latitude, p.longitude]; }),
          { color: lot.corHex || '#2563EB', weight: 3, dashArray: '5,4' }
        ).addTo(lotsLayer);
      }

      if (isActive) {
        lotPts.forEach(function(pt, idx) {
          L.circleMarker([pt.latitude, pt.longitude], {
            radius: 6,
            color: '#FFFFFF',
            weight: 2,
            fillColor: lot.corHex || '#2563EB',
            fillOpacity: 1
          }).bindTooltip((lot.nome || 'Lote') + ' · Ponto ' + (idx + 1)).addTo(lotsLayer);
        });
      }
    });

    if (!state.activeLotId) {
      (state.polygon || []).forEach(function(pt, idx) {
        L.circleMarker([pt.latitude, pt.longitude], {
          radius: 5.5,
          color: '#FFFFFF',
          weight: 2,
          fillColor: '#16A34A',
          fillOpacity: 1
        }).bindTooltip('Ponto ' + (idx + 1)).addTo(polyLayer);
      });
    }

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
    var prevCentroid = state.centroid;
    var prevShowWells = state.showWells;
    state = Object.assign({}, state, next);

    if (state.basemap === 'satellite') {
      if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
      if (!map.hasLayer(satLayer)) satLayer.addTo(map);
      if (!map.hasLayer(satLabelsLayer)) satLabelsLayer.addTo(map);
    } else {
      if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
      if (map.hasLayer(satLabelsLayer)) map.removeLayer(satLabelsLayer);
      if (!map.hasLayer(osmLayer)) osmLayer.addTo(map);
      if (osmLayer.bringToBack) osmLayer.bringToBack();
    }

    var mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.style.cursor = state.drawingMode ? 'crosshair' : 'grab';
    }

    var moved =
      !hasFittedInitialView ||
      Math.abs((prevCentroid.latitude || 0) - state.centroid.latitude) > 0.002 ||
      Math.abs((prevCentroid.longitude || 0) - state.centroid.longitude) > 0.002 ||
      prevShowWells !== state.showWells;
    if (moved || next.forceFit) {
      hasFittedInitialView = true;
    }
    renderOverlays(moved || Boolean(next.forceFit));
  };

  window.__recenterFarm = function() {
    renderOverlays(true);
  };

  emitHostMessage('farm', { type: 'ready' });
})();
</script>
</body>
</html>`;
}
