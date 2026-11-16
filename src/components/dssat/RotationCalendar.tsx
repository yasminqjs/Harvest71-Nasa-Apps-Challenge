import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { loadRotationPlan, saveRotationPlan } from '../../database/sqlite';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text } from '../../i18n/native';
import { translate } from '../../i18n/translate';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createRotationCompare, friendlyMessage, planRotationCalendar, type RotationCalendarResult } from '../../services/dssatApi';
import type { getAppTheme } from '../../theme/tokens';
import type { GeoPoint } from '../../types/domain';
import type { Capabilities, CatalogCrop, RotationCompareResult } from '../../types/dssat';
import type { SavedRotationPlan } from '../../types/rotationPlan';
import { allPairsEnabled, cycleValue, eligibleInSelection, suggestKnownCrops, targetMetric } from '../../utils/dssatLogic';
import { Card, Chip, ExpandableDetails, H, JobStatusBox, P, PrimaryButton, SectionDivider } from './DssatShared';
import { RotationCompareBarChart, RotationTimelineChart } from './DssatVisualCharts';
import { DAY, FuturePlantingDate, isoDay, tomorrow } from './FuturePlantingDate';
import { RotationGoalSearch } from './RotationGoalSearch';

type Cycles = SavedRotationPlan['cycles'];
type PlanMode = 'goals' | 'calendar';

function referenceDates(cycles: Cycles): string[] {
  const firstYear = Number(cycles[0].planting_date.slice(0, 4));
  // O ano de referência fica dentro do período aceito pelo motor. Preserva mês, dia e virada do ano.
  const leapInSecondYear = cycles.some(({ planting_date }) => planting_date.endsWith('-02-29') &&
    Number(planting_date.slice(0, 4)) === firstYear + 1);
  const referenceYear = leapInSecondYear ? 2019 : 2020;
  return cycles.map(({ planting_date }) =>
    `${referenceYear + Number(planting_date.slice(0, 4)) - firstYear}${planting_date.slice(4)}`);
}

const defaultDates = () => [
  isoDay(tomorrow() + 7 * DAY),
  isoDay(tomorrow() + 155 * DAY),
  isoDay(tomorrow() + 335 * DAY),
];

export function RotationCalendar({ crops, caps, theme, point, farmId, lotId, knownPlants }: {
  crops: CatalogCrop[]; caps: Capabilities | null; theme: ReturnType<typeof getAppTheme>;
  point: GeoPoint; farmId: string; lotId: string; knownPlants: string[];
}) {
  const { language } = useLanguage();
  const en = language === 'en';
  const [mode, setMode] = useState<PlanMode>('goals');
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState(defaultDates);
  const [result, setResult] = useState<RotationCalendarResult>();
  const [saved, setSaved] = useState<SavedRotationPlan | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const comparison = useDssatJob<RotationCompareResult>(JSON.stringify([farmId, lotId]), 'rotation');

  useEffect(() => {
    let active = true;
    loadRotationPlan(farmId, lotId)
      .then((plan) => { if (active) setSaved(plan); })
      .catch(() => {
        if (active) {
          setSaveError(
            en
              ? 'Could not read the saved plan on this device.'
              : 'Não foi possível ler o plano salvo neste dispositivo.'
          );
        }
      })
      .finally(() => { if (active) setLoadingSaved(false); });
    return () => { active = false; };
  }, [farmId, lotId, en]);

  const start = tomorrow();
  const end = start + 365 * DAY;
  const valid = dates.every((date, i) => Date.parse(date) >= start && Date.parse(date) <= end &&
    (i === 0 || date > dates[i - 1]));
  const windowCount = selected.length * dates.length;
  const suggestions = suggestKnownCrops(knownPlants, crops);
  const cropName = (code: string) => {
    const raw = crops.find((crop) => crop.code === code)?.name ?? code;
    return en ? translate(raw, 'en') : raw;
  };
  const invalidateCalendar = () => { setResult(undefined); setError(''); };

  // Precompute DSSAT sequence pairing info directly from capabilities so selection is crystal-clear.
  const { dssatCodes, partnerMap, dssatCrops, calendarOnlyCrops } = useMemo(() => {
    const codes = new Set<string>();
    const map = new Map<string, Set<string>>();
    for (const [a, b] of caps?.sequence_pairs ?? []) {
      codes.add(a);
      codes.add(b);
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a)!.add(b);
      map.get(b)!.add(a);
    }
    for (const c of caps?.crops ?? []) {
      if (c.dssat_sequence && map.get(c.code)?.size) {
        codes.add(c.code);
      }
    }
    return {
      dssatCodes: codes,
      partnerMap: map,
      dssatCrops: crops.filter((c) => codes.has(c.code)),
      calendarOnlyCrops: crops.filter((c) => !codes.has(c.code)),
    };
  }, [caps, crops]);

  const selectedDssat = selected.filter((code) => dssatCodes.has(code));
  const eligible = caps ? eligibleInSelection(selected, caps) : new Set<string>();
  const eligibleSize = eligible.size;

  const pairedLabels = useMemo(() => {
    const labelFor = (code: string) => {
      const raw = crops.find((crop) => crop.code === code)?.name ?? code;
      return en ? translate(raw, 'en') : raw;
    };
    const pairs: string[] = [];
    const seen = new Set<string>();
    for (const [a, b] of caps?.sequence_pairs ?? []) {
      if (selected.includes(a) && selected.includes(b)) {
        const key = [a, b].sort().join('+');
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push(`${labelFor(a)} ↔ ${labelFor(b)}`);
        }
      }
    }
    return pairs;
  }, [caps, selected, crops, en]);

  const suggestedPartners = useMemo(() => {
    if (selectedDssat.length === 0 || eligibleSize >= 2) return [];
    const out = new Set<string>();
    for (const code of selectedDssat) {
      for (const p of partnerMap.get(code) ?? []) {
        if (!selected.includes(p)) out.add(p);
      }
    }
    return [...out].slice(0, 4);
  }, [selectedDssat, eligibleSize, partnerMap, selected]);

  const activeMode: PlanMode = caps && caps.rotation_search === false ? 'calendar' : mode;

  const handleToggleCrop = (code: string) => {
    invalidateCalendar();
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  };

  const handleAddThirdDate = () => {
    if (dates.length >= 3) return;
    invalidateCalendar();
    const lastMs = Date.parse(dates[dates.length - 1]);
    const nextMs = Math.min(end, lastMs + 155 * DAY);
    if (nextMs > lastMs) {
      setDates((current) => [...current, isoDay(nextMs)]);
    } else {
      setDates(defaultDates());
    }
  };

  const handleSpaceDates = () => {
    invalidateCalendar();
    setDates(defaultDates());
  };

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
      setSaveError(
        en
          ? 'Could not save the plan on this device.'
          : 'Não foi possível salvar o plano neste dispositivo.'
      );
    } finally {
      setSaving(false);
    }
  }

  function showCycles(cycles: Cycles) {
    return <RotationTimelineChart theme={theme} cycles={cycles} cropName={cropName} />;
  }

  function compareButton(cycles: Cycles) {
    const codes = cycles.map((cycle) => cycle.crop);
    const years = cycles.map((cycle) => Number(cycle.planting_date.slice(0, 4)));
    const canCompare = caps && allPairsEnabled(codes, caps) && years[years.length - 1] - years[0] <= 1;
    if (!canCompare) {
      return (
        <P theme={theme} muted>
          {en
            ? 'To compare sequences, select two or three distinct crops with enabled DSSAT pairs.'
            : 'Para comparar ordens, escolha dois ou três cultivos distintos com pares habilitados no DSSAT.'}
        </P>
      );
    }
    return (
      <PrimaryButton
        theme={theme}
        label={en ? 'Compare orders in DSSAT' : 'Comparar ordens no DSSAT'}
        disabled={comparison.busy}
        onPress={() =>
          void comparison.submit(() =>
            createRotationCompare({
              lat: point.latitude,
              lon: point.longitude,
              crops: codes,
              planting_dates: referenceDates(cycles),
            })
          )
        }
      />
    );
  }

  const futureSaved = saved?.cycles.filter((cycle) => Date.parse(cycle.planting_date) >= start) ?? [];

  return (
    <View style={{ gap: 10 }}>
      {/* Primary Mode Switcher right at the TOP */}
      {caps?.rotation_search !== false && (
        <View style={[styles.modeBar, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Pressable
            onPress={() => setMode('goals')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeMode === 'goals' }}
            style={[
              styles.modeBtn,
              activeMode === 'goals' && { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons
              name="sparkles-outline"
              size={15}
              color={activeMode === 'goals' ? theme.primaryText : theme.text}
            />
            <Text
              style={{
                fontSize: 12.5 * theme.scale,
                fontWeight: '900',
                color: activeMode === 'goals' ? theme.primaryText : theme.text,
              }}
            >
              {en ? 'Goal Search (DSSAT)' : 'Buscar por Metas (DSSAT)'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('calendar')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeMode === 'calendar' }}
            style={[
              styles.modeBtn,
              activeMode === 'calendar' && { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={activeMode === 'calendar' ? theme.primaryText : theme.text}
            />
            <Text
              style={{
                fontSize: 12.5 * theme.scale,
                fontWeight: '900',
                color: activeMode === 'calendar' ? theme.primaryText : theme.text,
              }}
            >
              {en ? 'Calendar & Orders' : 'Calendário & Ordens'}
            </Text>
          </Pressable>
        </View>
      )}

      {saved && (
        <ExpandableDetails
          theme={theme}
          label={en ? 'Saved rotation plan on this device' : 'Plano salvo neste dispositivo'}
        >
          {showCycles(futureSaved)}
          {futureSaved.length < saved.cycles.length && (
            <P theme={theme}>
              {en
                ? 'Some saved plantings have already passed. Build a new calendar to update the plan.'
                : 'Alguns plantios salvos já passaram. Monte um novo calendário para atualizar o plano.'}
            </P>
          )}
          {futureSaved.length >= 2 && compareButton(futureSaved)}
          {futureSaved.length >= 2 && futureSaved.every((cycle) => Date.parse(cycle.planting_date) <= end) && (
            <PrimaryButton
              theme={theme}
              label={en ? 'Use saved plan to adjust dates' : 'Usar plano salvo para ajustar datas'}
              disabled={busy}
              onPress={() => {
                invalidateCalendar();
                setSelected([...new Set(futureSaved.map((cycle) => cycle.crop))]);
                setDates(futureSaved.map((cycle) => cycle.planting_date));
              }}
            />
          )}
        </ExpandableDetails>
      )}

      {saveError ? <Card theme={theme} tone="danger"><P theme={theme}>{saveError}</P></Card> : null}

      {/* Unified Crops + Dates Selector with clear pair guidance */}
      <Card theme={theme}>
        <View style={styles.sectionHeader}>
          <H theme={theme}>{en ? '1. Select Crops' : '1. Escolha as Culturas'}</H>
          {suggestions.length > 0 && (
            <Pressable
              onPress={() => {
                invalidateCalendar();
                setSelected((current) => [...new Set([...current, ...suggestions])]);
              }}
              style={[styles.miniLinkBtn, { borderColor: theme.primary }]}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                {en ? '+ Use plot crops' : '+ Culturas do lote'}
              </Text>
            </Pressable>
          )}
        </View>

        {caps && dssatCrops.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11.5 * theme.scale, fontWeight: '700', color: theme.textMuted }}>
              {selectedDssat.length === 0
                ? en
                  ? 'DSSAT-enabled crops (pick 2 or more that pair together):'
                  : 'Culturas habilitadas no DSSAT (escolha 2+ que formem par):'
                : en
                ? 'Green chips pair with your selection; dashed chips do not:'
                : 'Em verde = forma par com sua escolha; tracejado = sem par:'}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {dssatCrops.map((crop) => {
                const isSel = selected.includes(crop.code);
                const pairsWithAnySelected =
                  selectedDssat.length > 0 &&
                  selectedDssat.some((selCode) => selCode !== crop.code && partnerMap.get(selCode)?.has(crop.code));
                const isUnpairedSelected = isSel && selected.length >= 2 && !eligible.has(crop.code);
                const tone =
                  isSel || selectedDssat.length === 0
                    ? 'normal'
                    : pairsWithAnySelected
                    ? 'compatible'
                    : 'incompatible';

                return (
                  <Chip
                    key={crop.code}
                    theme={theme}
                    label={en ? translate(crop.name, 'en') : crop.name}
                    selected={isSel}
                    warn={isUnpairedSelected}
                    tone={tone}
                    disabled={busy}
                    onPress={() => handleToggleCrop(crop.code)}
                  />
                );
              })}
            </View>

            {/* Instant live feedback on active DSSAT pairs */}
            {eligible.size >= 2 ? (
              <View style={[styles.pairStrip, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
                <Ionicons name="checkmark-circle" size={14} color={theme.successText} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.successText, flex: 1 }}>
                  {en ? 'Valid DSSAT pairs:' : 'Pares prontos no DSSAT:'} {pairedLabels.join(' • ')}
                </Text>
              </View>
            ) : selectedDssat.length >= 1 && suggestedPartners.length > 0 ? (
              <View style={[styles.pairStrip, { backgroundColor: theme.warningBg, borderColor: theme.warningBorder }]}>
                <Ionicons name="link-outline" size={14} color={theme.warningText} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.warningText, flex: 1 }}>
                  {en
                    ? `Tap a partner to enable DSSAT: ${suggestedPartners.map(cropName).join(', ')}`
                    : `Toque num par para liberar o DSSAT: ${suggestedPartners.map(cropName).join(', ')}`}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {(!caps || activeMode === 'calendar') && calendarOnlyCrops.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {calendarOnlyCrops.map((crop) => (
              <Chip
                key={crop.code}
                theme={theme}
                label={en ? translate(crop.name, 'en') : crop.name}
                selected={selected.includes(crop.code)}
                disabled={busy}
                onPress={() => handleToggleCrop(crop.code)}
              />
            ))}
          </View>
        )}

        {caps && activeMode === 'goals' && calendarOnlyCrops.length > 0 && (
          <ExpandableDetails
            theme={theme}
            label={
              en
                ? `Calendar-only crops (${calendarOnlyCrops.length} — not supported in DSSAT rotations)`
                : `Culturas só de calendário (${calendarOnlyCrops.length} — fora da busca DSSAT)`
            }
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {calendarOnlyCrops.map((crop) => (
                <Chip
                  key={crop.code}
                  theme={theme}
                  label={en ? translate(crop.name, 'en') : crop.name}
                  selected={selected.includes(crop.code)}
                  warn={selected.includes(crop.code)}
                  disabled={busy}
                  onPress={() => handleToggleCrop(crop.code)}
                />
              ))}
            </View>
          </ExpandableDetails>
        )}

        {selected.length < 2 && (
          <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted }}>
            {en ? 'Select at least two crops.' : 'Selecione pelo menos duas culturas.'}
          </Text>
        )}

        <SectionDivider theme={theme} />

        <View style={styles.sectionHeader}>
          <H theme={theme}>{en ? '2. Planting Dates' : '2. Datas de Plantio'}</H>
          {dates.length === 3 || Date.parse(dates[1]) < end ? (
            <Pressable
              onPress={() => {
                invalidateCalendar();
                setDates((current) =>
                  current.length === 3
                    ? current.slice(0, 2)
                    : [...current, isoDay(Math.min(end, Date.parse(current[1]) + 120 * DAY))]
                );
              }}
              style={[styles.miniLinkBtn, { borderColor: theme.border }]}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>
                {dates.length === 3
                  ? en
                    ? 'Switch to 2 dates'
                    : 'Usar 2 datas'
                  : en
                  ? '+ Add 3rd date (DSSAT)'
                  : '+ 3ª data (DSSAT)'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {dates.map((date, index) => (
          <FuturePlantingDate
            key={index}
            label={en ? `Planting ${index + 1}` : `Plantio ${index + 1}`}
            value={date}
            min={Math.max(start, index === 0 ? start : Date.parse(dates[index - 1]) + DAY)}
            max={Math.min(end, index === dates.length - 1 ? end : Date.parse(dates[index + 1]) - DAY)}
            theme={theme}
            disabled={busy}
            onChange={(value) => {
              invalidateCalendar();
              setDates((current) => current.map((item, i) => i === index ? value : item));
            }}
          />
        ))}
        {!valid && (
          <PrimaryButton
            theme={theme}
            label={en ? 'Reset to future dates' : 'Atualizar para datas futuras'}
            disabled={busy}
            onPress={() => { invalidateCalendar(); setDates(defaultDates()); }}
          />
        )}
        {windowCount > 60 && (
          <P theme={theme}>
            {en ? 'With three dates, select up to 20 crops.' : 'Com três datas, selecione até 20 culturas.'}
          </P>
        )}
      </Card>

      {/* PRIMARY MODE: DSSAT Goal Search promoted right below crops/dates */}
      {activeMode === 'goals' && caps && valid && (
        <RotationGoalSearch
          key={JSON.stringify([dates, selected])}
          dates={dates}
          selected={selected}
          caps={caps}
          crops={crops}
          theme={theme}
          point={point}
          areaKey={JSON.stringify([farmId, lotId, dates, selected])}
          onAddThirdDate={handleAddThirdDate}
          onSpaceDates={handleSpaceDates}
        />
      )}

      {/* SECONDARY MODE: Calendar & Permutation Compare */}
      {activeMode === 'calendar' && (
        <>
          <PrimaryButton
            theme={theme}
            label={
              busy
                ? en
                  ? 'Building calendar…'
                  : 'Montando calendário…'
                : en
                ? 'View planting options'
                : 'Ver opções de plantio'
            }
            disabled={busy || !valid || selected.length < 2 || windowCount > 60}
            onPress={submit}
          />
          {error ? <Card theme={theme} tone="danger"><P theme={theme}>{error}</P></Card> : null}
          {result && valid && (
            <Card theme={theme}>
              <H theme={theme}>
                {en
                  ? `Possible calendars (${result.candidates.length})`
                  : `Calendários possíveis (${result.candidates.length})`}
              </H>
              {result.candidates.length === 0 && (
                <P theme={theme}>
                  {en
                    ? 'No crop cycle fit within the selected dates.'
                    : 'Nenhum ciclo coube nas datas informadas.'}
                </P>
              )}
              {result.candidates.map(({ cycles }, index) => (
                <View
                  key={index}
                  style={{
                    gap: 6,
                    paddingVertical: 8,
                    borderBottomWidth: index < result.candidates.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  }}
                >
                  <P theme={theme} bold>
                    {en ? `Option ${index + 1}` : `Opção ${index + 1}`}
                  </P>
                  {showCycles(cycles)}
                  <PrimaryButton
                    theme={theme}
                    label={
                      saving
                        ? en
                          ? 'Saving…'
                          : 'Salvando…'
                        : saved
                        ? en
                          ? 'Replace saved plan'
                          : 'Substituir plano salvo'
                        : en
                        ? 'Save this plan'
                        : 'Salvar este plano'
                    }
                    disabled={saving || loadingSaved}
                    onPress={() => void save(cycles)}
                  />
                  {cycles.length >= 2 && compareButton(cycles)}
                </View>
              ))}
              <ExpandableDetails
                theme={theme}
                label={en ? 'How dates are calculated' : 'Como as datas são calculadas'}
              >
                <P theme={theme} muted>
                  {en
                    ? 'End dates use reference crop cycle durations. To evaluate crop orders, DSSAT runs historical local weather.'
                    : 'As datas de fim usam a duração de referência das culturas. Para avaliar as ordens, o DSSAT usa clima histórico da área.'}
                </P>
                {result.truncated && (
                  <P theme={theme} muted>
                    {en
                      ? 'Additional options exist beyond those shown.'
                      : 'Existem outras opções além das exibidas.'}
                  </P>
                )}
              </ExpandableDetails>
            </Card>
          )}
          <JobStatusBox theme={theme} state={comparison.state} onRetry={comparison.retry} onReset={comparison.reset} />
          {comparison.state.phase === 'done' && comparison.state.result && (
            <Card theme={theme}>
              <H theme={theme}>
                {en ? 'Comparison with historical weather' : 'Comparação com clima histórico'}
              </H>
              <P theme={theme} muted>
                {en
                  ? 'Exploratory dry-matter production in kg/ha. Highlighted order matches the selected calendar.'
                  : 'Produção exploratória em kg/ha de matéria seca. A ordem marcada foi a do calendário escolhido.'}
              </P>
              {comparison.state.result.alternatives && (
                <RotationCompareBarChart
                  theme={theme}
                  alternatives={comparison.state.result.alternatives}
                  baselineId={comparison.state.result.baseline_id ?? undefined}
                  cropName={cropName}
                  valueOf={(cycle) => cycleValue(cycle, targetMetric(cycle.crop, caps))}
                />
              )}
              {comparison.state.result.failed_alternatives?.map((item) => (
                <P key={item.id} theme={theme}>
                  {item.order.map(cropName).join(' → ')}:{' '}
                  {item.reason ??
                    (en
                      ? 'incomplete plantings in simulation.'
                      : 'plantios incompletos na simulação.')}
                </P>
              ))}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniLinkBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pairStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
