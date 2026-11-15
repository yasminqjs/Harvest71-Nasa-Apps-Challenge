import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createRotationSearch } from '../../services/dssatApi';
import type { getAppTheme } from '../../theme/tokens';
import type { GeoPoint } from '../../types/domain';
import type { Capabilities, CatalogCrop, RotationSearchResult } from '../../types/dssat';
import { eligibleInSelection, fmtPct, targetMetric, validateSearchForm } from '../../utils/dssatLogic';
import { Card, H, JobStatusBox, P, PrimaryButton, dssatStyles } from './DssatShared';

export function RotationGoalSearch({ selected, dates, caps, crops, theme, point, areaKey }: {
  selected: string[]; dates: string[]; caps: Capabilities; crops: CatalogCrop[];
  theme: ReturnType<typeof getAppTheme>; point: GeoPoint; areaKey: string;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const job = useDssatJob<RotationSearchResult>(areaKey, 'rotation_search');
  const eligible = eligibleInSelection(selected, caps);
  const leapDate = dates.find((date) => date.endsWith('-02-29'));
  const leapOffset = leapDate ? Number(leapDate.slice(0, 4)) - Number(dates[0].slice(0, 4)) : 0;
  const years = leapDate ? [2012 - leapOffset, 2020 - leapOffset] : [2015, 2020];
  const errors = validateSearchForm({ selected, eligible, dates, years, targets });
  const name = (code: string) => crops.find((crop) => crop.code === code)?.name ?? code;
  const biomass = [...eligible].filter((code) => targetMetric(code, caps) === 'biomass_kg_ha');
  const result = job.state.phase === 'done' ? job.state.result : undefined;

  return (
    <Card theme={theme}>
      <H theme={theme}>Buscar rotações pelas suas metas</H>
      <P theme={theme} muted>O DSSAT testa até oito ordens com clima histórico, usando o mês e o dia dos plantios do plano.</P>
      {dates.length !== 3 && <P theme={theme}>Adicione o terceiro plantio para habilitar esta busca.</P>}
      {eligible.size < 2 && <P theme={theme}>Escolha culturas que formem pelo menos um par habilitado no DSSAT.</P>}
      {dates.length === 3 && eligible.size >= 2 && [...eligible].map((code) => {
        const label = `${name(code)} · ${biomass.includes(code) ? 'biomassa seca' : crops.find((crop) => crop.code === code)?.product ?? 'produto'} (kg/ha)`;
        return <View key={code}>
          <P theme={theme}>{label}</P>
          <TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={targets[code] ?? ''}
            editable={!job.busy} placeholder="Meta" placeholderTextColor={theme.textMuted}
            style={[dssatStyles.input, { borderColor: theme.border, color: theme.text }]}
            onChangeText={(value) => setTargets((current) => ({ ...current, [code]: value }))} />
        </View>;
      })}
      {dates.length === 3 && eligible.size >= 2 && errors[0] && <P theme={theme}>{errors[0]}</P>}
      <PrimaryButton theme={theme} label="Buscar com DSSAT" disabled={errors.length > 0 || job.busy}
        onPress={() => void job.submit(() => createRotationSearch({
          lat: point.latitude, lon: point.longitude, known_crops: selected,
          planting_dates: dates as [string, string, string], historical_start_years: years,
          yield_targets_kg_ha: Object.fromEntries([...eligible].map((code) => [code, Number(targets[code].replace(',', '.'))])),
          biomass_target_crops: biomass, max_candidates: 8,
        }))} />
      <JobStatusBox theme={theme} state={job.state} onRetry={job.retry} onReset={job.reset} />
      {result && <P theme={theme}>Ordens testadas: {result.search?.attempted_candidates ?? 'indisponível'}</P>}
      {result && !result.recommendations?.length && <P theme={theme}>Nenhuma ordem completou a comparação.</P>}
      {result?.recommendations?.map((option) => <View key={option.id}>
        <H theme={theme}>{option.order.map(name).join(' → ')}</H>
        <P theme={theme}>Todas as metas em {option.years_all_targets_met ?? 0} de {option.samples.length} safras simuladas.
          Cumprimento médio das metas: {fmtPct(option.mean_target_attainment ?? null)}.</P>
      </View>)}
    </Card>
  );
}
