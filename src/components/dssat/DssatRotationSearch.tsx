/**
 * "Rotações para meu talhão": busca (POST /rotations/search) entre as culturas que o agricultor conhece,
 * com metas por cultura; modo secundário compara ordens escolhidas (POST /rotations).
 * Plano: docs/PLANO_INTEGRACAO_FRONT_MAIN_DSSAT.md (seção 3).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useDssatCatalog } from '../../hooks/useDssatCatalog';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createRotationCompare, createRotationSearch } from '../../services/dssatApi';
import { getAppTheme } from '../../theme/tokens';
import { RotationCalendar } from './RotationCalendar';
import type {
  RotationCompareResult,
  RotationOption,
  RotationSearchResult,
} from '../../types/dssat';
import {
  allPairsEnabled,
  cycleValue,
  eligibleInSelection,
  fmtKg,
  fmtPct,
  suggestKnownCrops,
  targetMetric,
  validateSearchForm,
  yyyydddToBr,
} from '../../utils/dssatLogic';
import {
  Card,
  Chip,
  DssatHeader,
  H,
  JobStatusBox,
  P,
  PointInfo,
  PrimaryButton,
  SourceBadge,
  dssatStyles,
} from './DssatShared';

type Mode = 'calendar' | 'search' | 'compare';
const DEFAULT_DATES: [string, string, string] = ['1992-01-15', '1992-06-15', '1993-01-15'];
const YEAR_CHOICES = [1995, 2000, 2005, 2010, 2015, 2020];

export const DssatRotationSearch: React.FC<{ onBack: () => void; initialMode?: Mode }> = ({ onBack, initialMode = 'calendar' }) => {
  const { accessibility, activeFarm, activeFarmer, speak } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const { crops, caps, loading, error: catalogError, reload, cropName } = useDssatCatalog();
  const farmId = activeFarm?.id ?? 'sem-talhao';
  const search = useDssatJob<RotationSearchResult>(farmId, 'rotation_search');
  const compare = useDssatJob<RotationCompareResult>(farmId, 'rotation');

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([...DEFAULT_DATES]);
  const [years, setYears] = useState<number[]>([2015, 2020]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [openOption, setOpenOption] = useState<string | null>(null);

  // Todas as culturas do catálogo aparecem; as sem par na seleção atual ficam destacadas (plano, seção 3).
  const seqCrops = crops;
  const seqCapable = useMemo(
    () => new Set((caps?.crops ?? []).filter((c) => c.dssat_sequence).map((c) => c.code)),
    [caps]
  );

  // Sugestões do perfil/histórico: aparecem marcadas como sugestão; o agricultor confirma tocando.
  const suggested = useMemo(() => {
    if (!activeFarmer || crops.length === 0) return [];
    const names = [
      activeFarm?.culturaPrincipal,
      ...(activeFarmer.historicoCultivo ?? []),
      ...(activeFarmer.historicoCultivoDetalhado ?? []).flatMap((r) => [r.nomeCultura, ...(r.plantas ?? [])]),
    ];
    return suggestKnownCrops(names, crops);
  }, [activeFarmer, activeFarm, crops]);

  const eligible = useMemo(() => (caps ? eligibleInSelection(selected, caps) : new Set<string>()), [selected, caps]);
  const errors = validateSearchForm({ selected, eligible, dates, years, targets });
  const compareCrops = selected.slice(0, 3);
  const compareOk = selected.length <= 3 && !!caps && allPairsEnabled(compareCrops, caps);

  const searchResult = search.state.phase === 'done' ? search.state.result : undefined;
  const compareResult = compare.state.phase === 'done' ? compare.state.result : undefined;

  useEffectSpeak(searchResult, (r) => {
    const top = r.recommendations?.[0];
    speak(
      top
        ? `Busca pronta. A melhor rotação foi ${top.order.map(cropName).join(', depois ')}, que bateu todas as metas em ${top.years_all_targets_met ?? 0} de ${top.samples.length} anos simulados.`
        : 'Busca pronta, mas nenhuma ordem completou todos os plantios nas datas pedidas.'
    );
  });

  if (!activeFarm) return null;

  const job = mode === 'search' ? search : compare;
  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  const send = () => {
    if (mode === 'search') {
      if (errors.length) return;
      const codes = selected.filter((c) => eligible.has(c));
      const biomass = codes.filter((c) => targetMetric(c, caps) === 'biomass_kg_ha');
      void search.submit(() =>
        createRotationSearch({
          lat: activeFarm.centroid.latitude,
          lon: activeFarm.centroid.longitude,
          known_crops: selected,
          planting_dates: dates as [string, string, string],
          historical_start_years: [...years].sort(),
          yield_targets_kg_ha: Object.fromEntries(codes.map((c) => [c, Number(targets[c].replace(',', '.'))])),
          ...(biomass.length ? { biomass_target_crops: biomass } : {}),
          max_candidates: 8,
        })
      );
    } else {
      if (!compareOk) return;
      void compare.submit(() =>
        createRotationCompare({
          lat: activeFarm.centroid.latitude,
          lon: activeFarm.centroid.longitude,
          crops: compareCrops,
          planting_dates: dates.slice(0, compareCrops.length),
        })
      );
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <DssatHeader theme={theme} title="Rotações para meu talhão" onBack={onBack} />
      <PointInfo theme={theme} farm={activeFarm} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip theme={theme} label="Planejar datas futuras" selected={mode === 'calendar'} onPress={() => setMode('calendar')} />
        <Chip theme={theme} label="Buscar com clima histórico" selected={mode === 'search'} onPress={() => setMode('search')} />
        <Chip theme={theme} label="Comparar ordens com clima histórico" selected={mode === 'compare'} onPress={() => setMode('compare')} />
      </View>

      {catalogError ? (
        <Card theme={theme} tone="danger">
          <P theme={theme}>{catalogError}</P>
          <Pressable onPress={reload} accessibilityRole="button">
            <Text style={{ color: theme.dangerText, fontWeight: '800' }}>Tentar carregar de novo</Text>
          </Pressable>
        </Card>
      ) : null}

      {mode === 'calendar' ? (
        <RotationCalendar crops={crops} theme={theme} />
      ) : <>
      <Card theme={theme}>
        <H theme={theme}>1. Culturas que você sabe plantar</H>
        <P theme={theme} muted>
          {loading
            ? 'Carregando as culturas do simulador…'
            : mode === 'search'
            ? 'Toque para marcar. Precisam formar pares que o simulador já testou em sequência (⚠ = sem par).'
            : 'Marque 2 ou 3 culturas na ordem em que pretende plantar.'}
        </P>
        {suggested.length ? (
          <View style={{ gap: 6 }}>
            <P theme={theme} muted>Sugestões do seu histórico (confirme tocando):</P>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {suggested.map((code) => (
                <Chip key={code} theme={theme} label={`${cropName(code)}`} selected={selected.includes(code)} warn={!seqCapable.has(code)} onPress={() => toggle(code)} disabled={job.busy} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {seqCrops
            .filter((c) => !suggested.includes(c.code))
            .map((c) => (
              <Chip
                key={c.code}
                theme={theme}
                label={c.name}
                selected={selected.includes(c.code)}
                warn={!seqCapable.has(c.code) || (mode === 'search' && selected.includes(c.code) && selected.length > 1 && !eligible.has(c.code))}
                onPress={() => toggle(c.code)}
                disabled={job.busy}
              />
            ))}
        </View>
        {mode === 'search' && selected.some((c) => !eligible.has(c)) && selected.length > 1 ? (
          <Text style={{ color: theme.warningText, fontSize: 12 * theme.scale }}>
            ⚠ Sem par habilitado com as outras escolhidas: {selected.filter((c) => !eligible.has(c)).map(cropName).join(', ')}.
            Ficam fora da busca.
          </Text>
        ) : null}
        {mode === 'compare' && selected.length >= 2 && !compareOk ? (
          <Text style={{ color: theme.warningText, fontSize: 12 * theme.scale }}>
            ⚠ Para comparar, todas as culturas marcadas precisam formar pares habilitados entre si (máximo 3).
          </Text>
        ) : null}
      </Card>

      <Card theme={theme}>
        <H theme={theme}>2. Datas de plantio (posições)</H>
        <P theme={theme} muted>
          Formato AAAA-MM-DD, em ordem, dentro de dois anos seguidos. O ano aqui é só referência: as datas são repetidas
          nos anos históricos escolhidos abaixo.
        </P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {dates.slice(0, mode === 'compare' ? Math.max(2, compareCrops.length) : 3).map((d, i) => (
            <TextInput
              key={i}
              value={d}
              editable={!job.busy}
              onChangeText={(t) => setDates((p) => p.map((x, j) => (j === i ? t.trim() : x)))}
              accessibilityLabel={`Data de plantio ${i + 1}`}
              placeholder={DEFAULT_DATES[i]}
              placeholderTextColor={theme.textMuted}
              maxLength={10}
              style={[dssatStyles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
            />
          ))}
        </View>
      </Card>

      {mode === 'search' ? (
        <>
          <Card theme={theme}>
            <H theme={theme}>3. Anos de clima para testar</H>
            <P theme={theme} muted>Escolha 2 ou 3 anos. Cada ano é um clima real que já aconteceu no local.</P>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {YEAR_CHOICES.map((y) => (
                <Chip
                  key={y}
                  theme={theme}
                  label={String(y)}
                  selected={years.includes(y)}
                  disabled={job.busy || (!years.includes(y) && years.length >= 3)}
                  onPress={() => setYears((s) => (s.includes(y) ? s.filter((x) => x !== y) : [...s, y]))}
                />
              ))}
            </View>
          </Card>

          <Card theme={theme}>
            <H theme={theme}>4. Meta por cultura</H>
            <P theme={theme} muted>Quanto você espera colher por hectare. Use o mesmo produto do catálogo (grãos, raízes…).</P>
            {[...eligible].length === 0 ? <P theme={theme} muted>Marque culturas que formem par para preencher as metas.</P> : null}
            {[...eligible].map((code) => {
              const biomass = targetMetric(code, caps) === 'biomass_kg_ha';
              const crop = crops.find((c) => c.code === code);
              return (
                <View key={code} style={{ gap: 4 }}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 * theme.scale }}>
                    {cropName(code)} — {biomass ? 'biomassa seca (kg/ha)' : `${crop?.product ?? 'produção'} (kg/ha)`}
                  </Text>
                  <TextInput
                    value={targets[code] ?? ''}
                    editable={!job.busy}
                    keyboardType="numeric"
                    onChangeText={(t) => setTargets((p) => ({ ...p, [code]: t }))}
                    accessibilityLabel={`Meta de ${cropName(code)} em quilos por hectare`}
                    placeholder="ex.: 1000"
                    placeholderTextColor={theme.textMuted}
                    style={[dssatStyles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                  />
                </View>
              );
            })}
          </Card>

          {errors.length && selected.length > 0 ? (
            <Card theme={theme} tone="warning">
              {errors.map((e, i) => (
                <Text key={i} style={{ color: theme.warningText, fontSize: 12.5 * theme.scale }}>• {e}</Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {job.state.phase === 'idle' || job.state.phase === 'done' ? (
        <PrimaryButton
          theme={theme}
          icon="search-outline"
          label={mode === 'search' ? 'Buscar rotações' : 'Comparar ordens'}
          onPress={send}
          disabled={job.busy || (mode === 'search' ? errors.length > 0 : !compareOk)}
        />
      ) : null}

      <JobStatusBox theme={theme} state={job.state} onRetry={job.retry} onReset={job.reset} />

      {mode === 'search' && searchResult ? (
        <SearchResultView
          result={searchResult}
          theme={theme}
          cropName={cropName}
          metricFor={(c) => searchResult.target_metrics?.[c] ?? targetMetric(c, caps)}
          openOption={openOption}
          setOpenOption={setOpenOption}
        />
      ) : null}
      {mode === 'compare' && compareResult ? (
        <CompareResultView result={compareResult} theme={theme} cropName={cropName} metricFor={(c) => targetMetric(c, caps)} />
      ) : null}
      </>}
    </View>
  );
};

/** Fala o resumo uma vez por resultado. */
function useEffectSpeak<T extends { id: string }>(result: T | undefined, fn: (r: T) => void) {
  const spoken = useRef<string | null>(null);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (result && result.id !== spoken.current) {
      spoken.current = result.id;
      latest.current(result);
    }
  }, [result]);
}

const SearchResultView: React.FC<{
  result: RotationSearchResult;
  theme: ReturnType<typeof getAppTheme>;
  cropName: (c: string) => string;
  metricFor: (c: string) => string;
  openOption: string | null;
  setOpenOption: (id: string | null) => void;
}> = ({ result, theme, cropName, metricFor, openOption, setOpenOption }) => {
  const recs = result.recommendations ?? [];
  const rest = (result.ranked_alternatives ?? []).filter((o) => !recs.some((r) => r.id === o.id));
  const s = result.search ?? {};
  return (
    <View style={{ gap: 12 }}>
      <SourceBadge theme={theme} />
      <Card theme={theme}>
        <H theme={theme}>Melhores entre {s.attempted_candidates ?? '?'} ordens simuladas</H>
        <P theme={theme} muted>
          {s.calendar_eligible ?? '?'} ordens cabiam nas datas; {s.attempted_candidates ?? '?'} foram simuladas
          {s.budget_omitted ? ` (${s.budget_omitted} ficaram de fora pelo limite da busca)` : ''}. Classificação: anos em que
          todas as metas foram batidas e, no empate, o cumprimento médio das metas.
        </P>
        {recs.length === 0 ? (
          <P theme={theme}>
            Nenhuma ordem completou todos os plantios nas datas pedidas em todos os anos. Tente afastar as datas de plantio.
          </P>
        ) : null}
      </Card>

      {recs.map((o, i) => (
        <OptionCard key={o.id} option={o} rank={i + 1} theme={theme} cropName={cropName} metricFor={metricFor} open={openOption === o.id} onToggle={() => setOpenOption(openOption === o.id ? null : o.id)} />
      ))}

      {rest.length ? (
        <Card theme={theme}>
          <H theme={theme}>Outras ordens simuladas</H>
          {rest.map((o) => (
            <P key={o.id} theme={theme} muted>
              {o.order.map(cropName).join(' → ')}: metas em {o.years_all_targets_met ?? 0} de {o.samples.length} anos •{' '}
              {fmtPct(o.mean_target_attainment)} de cumprimento médio
            </P>
          ))}
        </Card>
      ) : null}

      {(result.incomplete_alternatives ?? []).length ? (
        <Card theme={theme} tone="warning">
          <H theme={theme}>Ordens que não completaram</H>
          {(result.incomplete_alternatives ?? []).map((o) => (
            <P key={o.id} theme={theme}>
              {o.order.map(cropName).join(' → ')} — falhou em {(o.failed_years ?? []).join(', ') || 'algum ano'} (datas apertadas para o ciclo).
            </P>
          ))}
        </Card>
      ) : null}

      <Card theme={theme}>
        <H theme={theme}>Premissas</H>
        {(result.assumptions ?? ['Sequeiro, variedades padrão, clima histórico e solo estimado.']).map((a, i) => (
          <P key={i} theme={theme} muted>• {a}</P>
        ))}
        <P theme={theme} muted>• Não é margem econômica: compara produção por cultura, cada uma na sua unidade.</P>
      </Card>
    </View>
  );
};

const OptionCard: React.FC<{
  option: RotationOption;
  rank: number;
  theme: ReturnType<typeof getAppTheme>;
  cropName: (c: string) => string;
  metricFor: (c: string) => string;
  open: boolean;
  onToggle: () => void;
}> = ({ option, rank, theme, cropName, metricFor, open, onToggle }) => (
  <Card theme={theme} tone={rank === 1 ? 'success' : 'normal'}>
    <Text style={{ fontWeight: '900', fontSize: 15 * theme.scale, color: theme.text }}>
      Opção {rank}: {option.order.map(cropName).join(' → ')}
    </Text>
    <P theme={theme}>
      Todas as metas em {option.years_all_targets_met ?? 0} de {option.samples.length} anos simulados •{' '}
      {fmtPct(option.mean_target_attainment)} de cumprimento médio das metas
    </P>
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Text style={{ color: theme.primary, fontWeight: '800' }}>{open ? 'Esconder detalhes' : 'Ver cada ano e cultura'}</Text>
    </Pressable>
    {open
      ? option.samples.map((s) => (
          <View key={s.start_year} style={{ gap: 2, paddingTop: 6 }}>
            <Text style={{ fontWeight: '800', color: theme.text, fontSize: 13 * theme.scale }}>
              Clima de {s.start_year}: {s.all_targets_met ? 'todas as metas batidas' : 'nem todas as metas batidas'}
            </Text>
            {s.cycles.map((c, i) => (
              <P key={i} theme={theme} muted>
                {cropName(c.crop)}: plantio {yyyydddToBr(c.planting_yyyyddd) ?? 'sem data'} • colheita{' '}
                {yyyydddToBr(c.maturity_yyyyddd) ?? 'sem data'} • {metricFor(c.crop) === 'biomass_kg_ha' ? 'biomassa ' : ''}
                {fmtKg(cycleValue(c, metricFor(c.crop)))} • chuva {c.rain_mm ?? 'sem dado'} mm
              </P>
            ))}
          </View>
        ))
      : null}
  </Card>
);

const CompareResultView: React.FC<{
  result: RotationCompareResult;
  theme: ReturnType<typeof getAppTheme>;
  cropName: (c: string) => string;
  metricFor: (c: string) => string;
}> = ({ result, theme, cropName, metricFor }) => (
  <View style={{ gap: 12 }}>
    <SourceBadge theme={theme} />
    {(result.alternatives ?? []).map((a) => (
      <Card key={a.id} theme={theme} tone={a.id === result.baseline_id ? 'success' : 'normal'}>
        <Text style={{ fontWeight: '900', fontSize: 14.5 * theme.scale, color: theme.text }}>
          {a.order.map(cropName).join(' → ')}
          {a.id === result.baseline_id ? ' (sua ordem)' : ''}
        </Text>
        {a.cycles.map((c, i) => {
          const m = metricFor(c.crop);
          const delta = a.minus_baseline?.[c.crop]?.[m];
          return (
            <P key={i} theme={theme} muted>
              {cropName(c.crop)}: {fmtKg(cycleValue(c, m))}
              {a.id !== result.baseline_id && delta !== undefined
                ? ` (${delta === null ? 'sem dado' : `${delta > 0 ? '+' : ''}${Math.round(delta)} kg/ha vs. sua ordem`})`
                : ''}{' '}
              • plantio {yyyydddToBr(c.planting_yyyyddd) ?? 'sem data'}
            </P>
          );
        })}
      </Card>
    ))}
    {(result.failed_alternatives ?? []).map((f) => (
      <Card key={f.id} theme={theme} tone="warning">
        <P theme={theme}>
          {f.order.map(cropName).join(' → ')}: {f.reason ?? 'não completou os plantios nas datas pedidas.'}
        </P>
      </Card>
    ))}
  </View>
);
