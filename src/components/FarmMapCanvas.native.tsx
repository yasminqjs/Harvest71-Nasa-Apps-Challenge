import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapPressEvent, Marker, Polygon } from 'react-native-maps';
import {
  FarmMapCanvas as VectorFallbackCanvas,
  FarmMapCanvasProps,
} from './FarmMapCanvas';

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

export const FarmMapCanvas: React.FC<FarmMapCanvasProps> = (props) => {
  const { centroid, polygon, wells, showWells, drawingMode, onAddPoint, theme } = props;
  const delta = showWells ? 0.14 : 0.0045;

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
              : 'Bahia • Mapa Nativo'}
          </Text>
        </View>
      </View>
    </MapErrorBoundary>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 255,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(17,24,39,0.82)',
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
