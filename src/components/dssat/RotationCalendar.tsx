import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { loadRotationPlan, saveRotationPlan } from '../../database/sqlite';
import { useLanguage } from '../../i18n/Language';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createRotationCompare, friendlyMessage, planRotationCalendar, type RotationCalendarResult } from '../../services/dssatApi';
import type { getAppTheme } from '../../theme/tokens';
import type { GeoPoint } from '../../types/domain';
import type { Capabilities, CatalogCrop, RotationCompareResult } from '../../types/dssat';
import type { SavedRotationPlan } from '../../types/rotationPlan';
import { allPairsEnabled, cycleValue, fmtKg, suggestKnownCrops, targetMetric } from '../../utils/dssatLogic';
import { Card, Chip, H, JobStatusBox, P, PrimaryButton } from './DssatShared';
import { DAY, FuturePlantingDate, isoDay, shortDate, tomorrow } from './FuturePlantingDate';
import { RotationGoalSearch } from './RotationGoalSearch';

type Cycles = SavedRotationPlan['cycles'];

function referenceDates(cycles: Cycles): string[] {
  const firstYear = Number(cycles[0].planting_date.slice(0, 4));
  // O ano de referência fica dentro do período aceito pelo motor. Preserva mês, dia e virada do ano.
  const leapInSecondYear = cycles.some(({ planting_date }) => planting_date.endsWith('-02-29') &&
    Number(planting_date.slice(0, 4)) === firstYear + 1);
  const referenceYear = leapInSecondYear ? 2019 : 2020;
  return cycles.map(({ planting_date }) =>
    `${referenceYear + Number(planting_date.slice(0, 4)) - firstYear}${planting_date.slice(4)}`);
}

const defaultDates = () => [isoDay(tomorrow() + 7 * DAY), isoDay(tomorrow() + 180 * DAY)];

export function RotationCalendar({ crops, caps, theme, point, farmId, lotId, knownPlants }: {
  crops: CatalogCrop[]; caps: Capabilities | null; theme: ReturnType<typeof getAppTheme>;
  point: GeoPoint; farmId: string; lotId: string; knownPlants: string[];
}) {
  const { language } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState(defaultDates);
  const [result, setResult] = useState<RotationCalendarResult>();
  const [saved, setSaved] = useState<SavedRotationPlan | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const comparison = useDssatJob<RotationCompareResult>(JSON.stringify([farmId, lotId]), 'rotation');

  useEffect(() => {
    let active = true;
    loadRotationPlan(farmId, lotId)
      .then((plan) => { if (active) setSaved(plan); })
      .catch(() => { if (active) setSaveError('Não foi possível ler o plano salvo neste dispositivo.'); })
      .finally(() => { if (active) setLoadingSaved(false); });
    return () => { active = false; };
  }, [farmId, lotId]);

  const start = tomorrow();
  const end = start + 365 * DAY;
  const valid = dates.every((date, i) => Date.parse(date) >= start && Date.parse(date) <= end &&
    (i === 0 || date > dates[i - 1]));
  const windowCount = selected.length * dates.length;
  const suggestions = suggestKnownCrops(knownPlants, crops);
  const cropName = (code: string) => crops.find((crop) => crop.code === code)?.name ?? code;
  const invalidateCalendar = () => { setResult(undefined); setError(''); };

  async function submit() {
    if (busy || !valid || selected.length < 2 || windowCount > 60) return;
    setBusy(true);
    invalidateCalendar();
    try {
      setResult(await planRotationCalendar({
        horizon_start: dates[0],
        horizon_end: isoDay(Date.parse(dates[dates.length - 1]) + 730 * DAY),
        known_crops: selected,
        windows: dates.flatMap((planting_date) => selected.map((crop) => ({ crop, planting_date }))),
        max_cycles: dates.length,
      }));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(cycles: Cycles) {
    if (saving || loadingSaved || cycles.some((cycle) => Date.parse(cycle.planting_date) < tomorrow())) return;
    setSaving(true);
    setSaveError('');
    const plan = { savedAt: new Date().toISOString(), cycles };
    try {
      await saveRotationPlan(farmId, lotId, plan);
      setSaved(plan);
    } catch {
      setSaveError('Não foi possível salvar o plano neste dispositivo.');
    } finally {
      setSaving(false);
    }
  }

  function showCycles(cycles: Cycles) {
    return cycles.map((cycle) => (
      <P key={cycle.planting_date} theme={theme}>
        {cropName(cycle.crop)}{' · '}{shortDate(cycle.planting_date, language)} até {shortDate(cycle.end_date, language)}
      </P>
    ));
  }

  function compareButton(cycles: Cycles) {
    const codes = cycles.map((cycle) => cycle.crop);
    const years = cycles.map((cycle) => Number(cycle.planting_date.slice(0, 4)));
    const canCompare = caps && allPairsEnabled(codes, caps) && years[years.length - 1] - years[0] <= 1;
    if (!canCompare) {
      return <P theme={theme} muted>Para comparar ordens, escolha dois ou três cultivos distintos com pares habilitados no DSSAT.</P>;
    }
    return <PrimaryButton theme={theme} label="Comparar ordens no DSSAT" disabled={comparison.busy}
      onPress={() => void comparison.submit(() => createRotationCompare({
        lat: point.latitude, lon: point.longitude, crops: codes, planting_dates: referenceDates(cycles),
      }))} />;
  }

  const futureSaved = saved?.cycles.filter((cycle) => Date.parse(cycle.planting_date) >= start) ?? [];

  return (
    <View style={{ gap: 12 }}>
      {saved && <Card theme={theme} tone="success">
        <H theme={theme}>Plano salvo neste dispositivo</H>
        {showCycles(futureSaved)}
        {futureSaved.length < saved.cycles.length && <P theme={theme}>Alguns plantios salvos já passaram. Monte um novo calendário para atualizar o plano.</P>}
        {futureSaved.length >= 2 && compareButton(futureSaved)}
        {futureSaved.length >= 2 && futureSaved.every((cycle) => Date.parse(cycle.planting_date) <= end) &&
          <PrimaryButton theme={theme} label="Usar plano salvo para ajustar datas" disabled={busy}
            onPress={() => {
              invalidateCalendar();
              setSelected([...new Set(futureSaved.map((cycle) => cycle.crop))]);
              setDates(futureSaved.map((cycle) => cycle.planting_date));
            }} />}
      </Card>}
      {saveError ? <Card theme={theme} tone="danger"><P theme={theme}>{saveError}</P></Card> : null}
      <Card theme={theme}>
        <H theme={theme}>O que você pode plantar?</H>
        {suggestions.length > 0 && <Chip theme={theme} label="Usar culturas do lote" selected={false} disabled={busy}
          onPress={() => { invalidateCalendar(); setSelected((current) => [...new Set([...current, ...suggestions])]); }} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {crops.map((crop) => (
            <Chip key={crop.code} theme={theme} label={crop.name} selected={selected.includes(crop.code)} disabled={busy}
              onPress={() => {
                invalidateCalendar();
                setSelected((current) => current.includes(crop.code) ? current.filter((code) => code !== crop.code) : [...current, crop.code]);
              }} />
          ))}
        </View>
        <P theme={theme} muted>Selecione pelo menos duas culturas.</P>
        <P theme={theme} muted>O calendário aceita todas as culturas do catálogo. O DSSAT compara apenas combinações habilitadas para rotação.</P>
      </Card>
      <Card theme={theme}>
        <H theme={theme}>Quando você pode plantar?</H>
        <P theme={theme} muted>As datas sugeridas são um ponto de partida. Toque para escolher um dia futuro no calendário.</P>
        {dates.map((date, index) => (
          <FuturePlantingDate key={index} label={`Plantio ${index + 1}`} value={date}
            min={Math.max(start, index === 0 ? start : Date.parse(dates[index - 1]) + DAY)}
            max={Math.min(end, index === dates.length - 1 ? end : Date.parse(dates[index + 1]) - DAY)}
            theme={theme} disabled={busy}
            onChange={(value) => {
              invalidateCalendar();
              setDates((current) => current.map((item, i) => i === index ? value : item));
            }} />
        ))}
        {dates.length === 3 || Date.parse(dates[1]) < end ? <Chip theme={theme}
          label={dates.length === 3 ? 'Remover terceiro plantio' : 'Adicionar terceiro plantio'}
          selected={false} disabled={busy} onPress={() => {
            invalidateCalendar();
            setDates((current) => current.length === 3 ? current.slice(0, 2)
              : [...current, isoDay(Math.min(end, Date.parse(current[1]) + 120 * DAY))]);
          }} /> : null}
        {!valid && <PrimaryButton theme={theme} label="Atualizar para datas futuras"
          disabled={busy} onPress={() => { invalidateCalendar(); setDates(defaultDates()); }} />}
        {windowCount > 60 && <P theme={theme}>Com três datas, selecione até 20 culturas.</P>}
      </Card>
      <PrimaryButton theme={theme} label={busy ? 'Montando calendário…' : 'Ver opções de plantio'}
        disabled={busy || !valid || selected.length < 2 || windowCount > 60} onPress={submit} />
      {error ? <Card theme={theme} tone="danger"><P theme={theme}>{error}</P></Card> : null}
      {result && valid && <View style={{ gap: 8 }}>
        <H theme={theme}>Calendários possíveis</H>
        <P theme={theme}>As datas de fim usam a duração de referência das culturas. Para avaliar as ordens, o DSSAT usa clima histórico da área.</P>
        {result.candidates.length === 0 && <P theme={theme}>Nenhum ciclo coube nas datas informadas.</P>}
        {result.candidates.map(({ cycles }, index) => (
          <Card key={index} theme={theme}>
            <H theme={theme}>{`Opção ${index + 1}`}</H>
            {showCycles(cycles)}
            <PrimaryButton theme={theme} label={saving ? 'Salvando…' : saved ? 'Substituir plano salvo' : 'Salvar este plano'}
              disabled={saving || loadingSaved} onPress={() => void save(cycles)} />
            {cycles.length >= 2 && compareButton(cycles)}
          </Card>
        ))}
        {result.truncated && <P theme={theme}>Existem outras opções além das exibidas.</P>}
      </View>}
      <JobStatusBox theme={theme} state={comparison.state} onRetry={comparison.retry} onReset={comparison.reset} />
      {comparison.state.phase === 'done' && comparison.state.result && <Card theme={theme}>
        <H theme={theme}>Comparação com clima histórico</H>
        <P theme={theme} muted>Produção exploratória em kg/ha de matéria seca. A ordem marcada foi a do calendário escolhido.</P>
        {comparison.state.result.alternatives?.map((option) => (
          <View key={option.id}>
            <H theme={theme}>{option.order.map(cropName).join(' → ')}
              {option.id === comparison.state.result?.baseline_id ? ' (ordem escolhida)' : ''}
            </H>
            {option.cycles.map((cycle) => <P key={cycle.crop} theme={theme}>
              {cropName(cycle.crop)}: {fmtKg(cycleValue(cycle, targetMetric(cycle.crop, caps)))}
            </P>)}
          </View>
        ))}
        {comparison.state.result.failed_alternatives?.map((item) =>
          <P key={item.id} theme={theme}>{item.order.map(cropName).join(' → ')}: {item.reason ?? 'plantios incompletos na simulação.'}</P>)}
      </Card>}
      {caps?.rotation_search && <>
        <Chip theme={theme} label="Buscar por metas de produção" selected={showGoals}
          onPress={() => setShowGoals((show) => !show)} />
        {showGoals && valid && <RotationGoalSearch
          key={JSON.stringify([dates, selected])} dates={dates} selected={selected} caps={caps}
          crops={crops} theme={theme} point={point} areaKey={JSON.stringify([farmId, lotId, dates, selected])} />}
      </>}
    </View>
  );
}
