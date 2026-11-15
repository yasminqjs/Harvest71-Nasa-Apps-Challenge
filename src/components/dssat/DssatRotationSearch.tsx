import React, { useState } from 'react';
import { View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useDssatCatalog } from '../../hooks/useDssatCatalog';
import { getAppTheme } from '../../theme/tokens';
import { calculatePolygonMetrics } from '../../utils/geoprocessing';
import { Card, Chip, DssatHeader, H, P, PrimaryButton } from './DssatShared';
import { RotationCalendar } from './RotationCalendar';

export function DssatRotationSearch({ onBack, initialLotId }: { onBack: () => void; initialLotId?: string }) {
  const { activeFarm, accessibility } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const { crops, caps, loading, error, reload } = useDssatCatalog();
  const [selectedLotId, setSelectedLotId] = useState(initialLotId);
  const lots = activeFarm?.lotes ?? [];
  const lot = lots.find((item) => item.id === selectedLotId) ?? lots[0];

  if (!activeFarm) return null;
  const hasLotPosition = !!lot && lot.polygon.length >= 3;
  const point = hasLotPosition ? calculatePolygonMetrics(lot.polygon).centroid : activeFarm.centroid;

  return (
    <View style={{ gap: 12 }}>
      <DssatHeader theme={theme} title="Planejar rotação" onBack={onBack} />
      <Card theme={theme}>
        <H theme={theme}>Área do plano</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {lots.map((item) => <Chip key={item.id} theme={theme} label={item.nome}
            selected={item.id === lot?.id} onPress={() => setSelectedLotId(item.id)} />)}
        </View>
        <P theme={theme}>{lot ? `Plantio atual: ${lot.culturaAtual}` : 'Plano para a fazenda inteira'}</P>
        {!hasLotPosition && <P theme={theme} muted>O DSSAT usará a localização da fazenda.</P>}
      </Card>
      {loading && <P theme={theme}>Carregando culturas…</P>}
      {error && <Card theme={theme} tone="danger">
        <P theme={theme}>{error}</P>
        <PrimaryButton theme={theme} label="Tentar carregar novamente" onPress={reload} />
      </Card>}
      <RotationCalendar key={JSON.stringify([activeFarm.id, lot?.id])}
        crops={crops} caps={caps} theme={theme} point={point} farmId={activeFarm.id}
        lotId={lot?.id ? `lot:${lot.id}` : 'farm'} knownPlants={lot?.plantasRotacao ?? []} />
    </View>
  );
}
