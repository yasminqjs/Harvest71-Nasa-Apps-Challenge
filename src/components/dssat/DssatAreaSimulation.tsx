/**
 * "Meu talhão no DSSAT": uma cultura no talhão ativo — solo do local, janelas de plantio, faixas de
 * produção por safra histórica e, opcionalmente, o clima futuro (NASA NEX-GDDP-CMIP6).
 * POST /simulations → poll. O diagnóstico local do app continua separado.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Pressable, Text, TextInput } from '../../i18n/native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useDssatCatalog } from '../../hooks/useDssatCatalog';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createSimulation } from '../../services/dssatApi';
import { getAppTheme } from '../../theme/tokens';
import type { ScenarioSummary, SimulationResult } from '../../types/dssat';
import { useLanguage } from '../../i18n/Language';
import {
  cropCodeFromName,
  soilSummary,
} from '../../utils/dssatLogic';
import {
  Card,
  Chip,
  DssatHeader,
  ExpandableDetails,
  H,
  JobStatusBox,
  P,
  PointInfo,
  PrimaryButton,
  SectionDivider,
  SourceBadge,
  dssatStyles,
} from './DssatShared';
import {
  FutureYieldComparisonChart,
  PlotSoilVisual,
  YieldRangeChart,
  getFriendlyClimateScenario,
} from './DssatVisualCharts';

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
type FutureChoice = 'none' | string;

export const DssatAreaSimulation: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { accessibility, activeFarm, speak } = useAccessibility();
  const { language } = useLanguage();
  const theme = getAppTheme(accessibility);
  const { crops, projection, loading, error: catalogError, reload } = useDssatCatalog({ includeCapabilities: false });
  const farmId = activeFarm?.id ?? 'sem-talhao';
  const { state, busy, submit, retry, reset } = useDssatJob<SimulationResult>(farmId, 'simulation');

  const [chosenCrop, setCrop] = useState<string | null>(null);
  const [autoWindows, setAutoWindows] = useState(true);
  const [windows, setWindows] = useState<string[]>(['', '', '']);
  const [future, setFuture] = useState<FutureChoice>('none');
  const spokenFor = useRef<string | null>(null);

  // Sugere a cultura principal do talhão (o usuário pode trocar).
  const suggestedCrop = useMemo(
    () => (activeFarm && crops.length ? cropCodeFromName(activeFarm.culturaPrincipal, crops) : null),
    [activeFarm, crops]
  );
  const crop = chosenCrop ?? suggestedCrop;

  const scenarios = projection?.available?.scenarios ?? {};
  const period = projection?.available?.periods?.[0];

  const result = state.result;
  useEffect(() => {
    if (state.phase !== 'done' || !result || spokenFor.current === result.id) return;
    spokenFor.current = result.id;
    const best = bestRainfed(result.scenario_summary);
    if (best) {
      speak(
        `Simulação pronta para ${result.crop?.name ?? 'a cultura'}. A melhor janela de sequeiro foi ` +
          `${best.name.replace(/Janela \d /, '')}, com produção típica de ${Math.round(best.yield_kg_ha.p50 ?? 0)} quilos por hectare.`
      );
    }
  }, [state.phase, result, speak]);

  if (!activeFarm) return null;

  const windowErrors = autoWindows
    ? []
    : windows.filter((w) => w.trim()).filter((w) => !MMDD.test(w.trim()) || w.trim() === '02-29');
  const chosenWindows = windows.map((w) => w.trim()).filter(Boolean);
  const canSend =
    !!crop && !busy && (autoWindows || (chosenWindows.length > 0 && windowErrors.length === 0));

  const send = () => {
    if (!crop) return;
    void submit(() =>
      createSimulation({
        lat: activeFarm.centroid.latitude,
        lon: activeFarm.centroid.longitude,
        crop,
        ...(autoWindows ? {} : { planting_windows: [...new Set(chosenWindows)] }),
        ...(future !== 'none' && period ? { climate_projection: { scenario: future, period } } : {}),
      })
    );
  };

  const en = language === 'en';
  const best = bestRainfed(result?.scenario_summary);
  const headerSpeech = en
    ? result
      ? `My Plot in DSSAT for ${activeFarm.nome}. Crop: ${result.crop?.name ?? crop ?? ''}. Best rainfed window: ${
          best ? `${best.name}, typical yield ${Math.round(best.yield_kg_ha.p50 ?? 0)} kilograms per hectare.` : 'check charts on screen.'
        }`
      : `My Plot in DSSAT for ${activeFarm.nome}. Select a crop, planting dates, and optional future climate scenario to simulate using NASA POWER and PronaSolos.`
    : result
    ? `Meu talhão no DSSAT para ${activeFarm.nome}. Cultura ${result.crop?.name ?? crop ?? ''}. Melhor janela de sequeiro: ${
        best ? `${best.name}, produção típica de ${Math.round(best.yield_kg_ha.p50 ?? 0)} quilos por hectare.` : 'veja os gráficos na tela.'
      }`
    : `Meu talhão no DSSAT para ${activeFarm.nome}. Escolha a cultura, as datas de plantio e o cenário climático futuro opcional para simular com NASA POWER e PronaSolos.`;

  return (
    <View style={{ gap: 12 }}>
      <DssatHeader theme={theme} title="Meu talhão no DSSAT" onBack={onBack} speechText={headerSpeech} />
      <PointInfo theme={theme} farm={activeFarm} />

      {catalogError ? (
        <Card theme={theme} tone="danger">
          <P theme={theme}>{catalogError}</P>
          <Pressable onPress={reload} accessibilityRole="button">
            <Text style={{ color: theme.dangerText, fontWeight: '800' }}>Tentar carregar de novo</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* -------- formulário enxuto em folha única -------- */}
      <Card theme={theme}>
        <H theme={theme}>1. Cultura</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {crops.map((c) => (
            <Chip key={c.code} theme={theme} label={c.name} selected={crop === c.code} onPress={() => setCrop(c.code)} disabled={busy} />
          ))}
        </View>
        {loading ? <P theme={theme} muted>Carregando o catálogo do simulador…</P> : null}

        <SectionDivider theme={theme} />

        <H theme={theme}>2. Datas de plantio</H>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip theme={theme} label="Automático (pelo clima do local)" selected={autoWindows} onPress={() => setAutoWindows(true)} disabled={busy} />
          <Chip theme={theme} label="Escolher datas" selected={!autoWindows} onPress={() => setAutoWindows(false)} disabled={busy} />
        </View>
        {autoWindows ? (
          <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted }}>
            {language === 'en'
              ? 'Uses rainy-season start estimated from local weather (check ZARC).'
              : 'Usa o início estimado da chuva no local (confira com o ZARC).'}
          </Text>
        ) : (
          <>
            <P theme={theme} muted>Até três datas no formato mês-dia (MM-DD), por exemplo 03-15.</P>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {windows.map((w, i) => (
                <TextInput
                  key={i}
                  value={w}
                  editable={!busy}
                  onChangeText={(t) => setWindows((prev) => prev.map((x, j) => (j === i ? t : x)))}
                  placeholder={['03-01', '04-01', '05-01'][i]}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={`Data de plantio ${i + 1}, mês e dia`}
                  maxLength={5}
                  style={[dssatStyles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                />
              ))}
            </View>
            {windowErrors.length ? (
              <Text style={{ color: theme.dangerText, fontSize: 12 * theme.scale }}>
                Data inválida: {windowErrors.join(', ')} (use MM-DD; 29/02 não é aceito).
              </Text>
            ) : null}
          </>
        )}

        <SectionDivider theme={theme} />

        <H theme={theme}>3. Clima futuro (opcional)</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            theme={theme}
            label={language === 'en' ? 'Current climate' : 'Só clima atual'}
            selected={future === 'none'}
            onPress={() => setFuture('none')}
            disabled={busy}
          />
          {Object.entries(scenarios).map(([id, label]) => {
            const info = getFriendlyClimateScenario(id, label, language);
            return (
              <Chip
                key={id}
                theme={theme}
                label={info.shortTitle}
                selected={future === id}
                onPress={() => setFuture(id)}
                disabled={busy || !period}
              />
            );
          })}
        </View>
        {future !== 'none' && (() => {
          const activeInfo = getFriendlyClimateScenario(future, scenarios[future], language);
          return (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12 * theme.scale, fontWeight: '700', color: activeInfo.accentColor }}>
                {activeInfo.title}: <Text style={{ fontWeight: '400', color: theme.textMuted }}>{activeInfo.description}</Text>
              </Text>
              <ExpandableDetails
                theme={theme}
                label={language === 'en' ? `About ${period ?? 'mid-century'} climate scenarios` : `Sobre os cenários (${period ?? 'meados do século'})`}
              >
                <Text style={{ fontSize: 11 * theme.scale, color: theme.textMuted, lineHeight: 16 }}>
                  {language === 'en'
                    ? `${activeInfo.technicalCode} compares NASA CMIP6 mid-century projections against local historical weather (NASA POWER).`
                    : `${activeInfo.technicalCode} compara projeções da NASA CMIP6 para ${period ?? 'meados do século'} sobre o histórico local (NASA POWER).`}
                </Text>
              </ExpandableDetails>
            </View>
          );
        })()}
        {!projection ? <P theme={theme} muted>Opções de clima futuro indisponíveis agora.</P> : null}
      </Card>

      {state.phase === 'idle' || state.phase === 'done' ? (
        <PrimaryButton
          theme={theme}
          icon="play-circle-outline"
          label={state.phase === 'done' ? 'Simular de novo' : 'Simular no meu talhão'}
          onPress={send}
          disabled={!canSend}
        />
      ) : null}

      <JobStatusBox
        theme={theme}
        state={state}
        onRetry={retry}
        onReset={reset}
        runningExtra={future !== 'none' ? 'Com clima futuro, o resultado de hoje aparece primeiro.' : undefined}
      />

      {result?.scenario_summary ? <SimulationView result={result} theme={theme} /> : null}
    </View>
  );
};

function bestRainfed(rows?: ScenarioSummary[]): ScenarioSummary | undefined {
  return (rows ?? [])
    .filter((r) => !r.irrigated && r.yield_kg_ha?.p50 !== null)
    .sort((a, b) => (b.yield_kg_ha.p50 ?? 0) - (a.yield_kg_ha.p50 ?? 0))[0];
}

const SimulationView: React.FC<{
  result: SimulationResult;
  theme: ReturnType<typeof getAppTheme>;
}> = ({ result, theme }) => {
  const { language } = useLanguage();
  const soil = soilSummary(result.soil?.layers, result.soil?.texture_top);
  const best = bestRainfed(result.scenario_summary);
  const nYears = result.seasons?.n_years;
  const cp = result.climate_projection;
  const product = result.crop?.product ?? 'produção';

  return (
    <View style={{ gap: 12 }}>
      <SourceBadge theme={theme} />

      {/* Solo do local */}
      {soil ? (
        <Card theme={theme}>
          <H theme={theme}>Solo do talhão</H>
          <PlotSoilVisual
            theme={theme}
            soil={soil}
            layers={result.soil?.layers}
            sourceLabel={result.soil?.source}
            warnings={result.soil?.warnings}
          />
        </Card>
      ) : null}

      {/* Resultado por janela */}
      <Card theme={theme}>
        <H theme={theme}>
          {result.crop?.name ?? 'Cultura'} — {product}
        </H>
        <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted }}>
          {nYears ?? '?'} {language === 'en' ? 'seasons' : 'safras'} ({result.climate?.period?.[0]?.slice(0, 4) ?? '1991'}–{result.climate?.period?.[1]?.slice(0, 4) ?? '2025'})
        </Text>
        <YieldRangeChart
          theme={theme}
          scenarios={result.scenario_summary ?? []}
          bestTrno={best?.trno}
        />
        <ExpandableDetails
          theme={theme}
          label={language === 'en' ? 'Cultivar, methodology & assumptions' : 'Variedade, método e premissas'}
        >
          <P theme={theme} muted>
            Variedade {result.crop?.cultivar?.name ?? 'padrão'}.
            {result.planting_windows_source ? ` Datas: ${result.planting_windows_source}.` : ''}
          </P>
          <P theme={theme} muted>
            “Ano ruim/bom” = 10% piores/melhores safras simuladas. É comparação entre datas e manejo, não previsão da próxima safra.
          </P>
          {result.assumptions
            ? Object.values(result.assumptions).map((a, i) => (
                <P key={i} theme={theme} muted>• {a}</P>
              ))
            : null}
        </ExpandableDetails>
      </Card>

      {/* Clima futuro */}
      {cp ? <ProjectionView cp={cp} theme={theme} running={result.status === 'running'} language={language} /> : null}
    </View>
  );
};

const ProjectionView: React.FC<{
  cp: NonNullable<SimulationResult['climate_projection']>;
  theme: ReturnType<typeof getAppTheme>;
  running: boolean;
  language: 'en' | 'pt';
}> = ({ cp, theme, running, language }) => {
  if (running && !cp.status) {
    return (
      <Card theme={theme} tone="warning">
        <P theme={theme}>Calculando o clima futuro…</P>
      </Card>
    );
  }
  if (cp.status === 'unavailable' || cp.status === 'failed') {
    return (
      <Card theme={theme} tone="warning">
        <H theme={theme}>Clima futuro</H>
        <P theme={theme}>
          {cp.status === 'unavailable'
            ? 'Projeção futura ainda indisponível para esta área. Os dados da NASA estão sendo preparados; tente mais tarde.'
            : 'Não foi possível calcular o clima futuro desta vez. O resultado de hoje acima continua válido.'}
        </P>
      </Card>
    );
  }
  const models = cp.models ?? [];
  const n = models.length;
  const friendly = getFriendlyClimateScenario(cp.scenario, cp.scenario_name, language);
  return (
    <Card theme={theme} tone="success">
      <H theme={theme}>
        {language === 'en' ? `Future (${cp.period}) — ${friendly.shortTitle}` : `Futuro ${cp.period} — ${friendly.shortTitle}`}
      </H>
      <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted }}>
        {friendly.description}
      </Text>
      <FutureYieldComparisonChart theme={theme} ensemble={cp.ensemble ?? []} models={models} />
      <ExpandableDetails
        theme={theme}
        label={language === 'en' ? 'Scientific caveats & data source' : 'Notas científicas e fonte'}
      >
        <SourceBadge theme={theme} text="Projeção NASA NEX-GDDP-CMIP6 aplicada ao clima NASA POWER do local" />
        <P theme={theme} muted>
          {friendly.technicalCode} •{' '}
          {n < 3 ? `Por enquanto ${n} modelo${n === 1 ? '' : 's'} pronto${n === 1 ? '' : 's'}; os outros entram quando a NASA terminar de ser processada. ` : ''}
          Tendência de longo prazo, não previsão de um ano específico. CO₂ no nível atual; a ordem dos anos secos é a observada.
        </P>
      </ExpandableDetails>
    </Card>
  );
};
