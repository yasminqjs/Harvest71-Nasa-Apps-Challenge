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
import {
  cropCodeFromName,
  fmtKg,
  fmtPct,
  fmtSignedPct,
  soilSummary,
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

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
type FutureChoice = 'none' | string;

export const DssatAreaSimulation: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { accessibility, activeFarm, speak } = useAccessibility();
  const theme = getAppTheme(accessibility);
  const { crops, projection, loading, error: catalogError, reload } = useDssatCatalog({ includeCapabilities: false });
  const farmId = activeFarm?.id ?? 'sem-talhao';
  const { state, busy, submit, retry, reset } = useDssatJob<SimulationResult>(farmId, 'simulation');

  const [chosenCrop, setCrop] = useState<string | null>(null);
  const [autoWindows, setAutoWindows] = useState(true);
  const [windows, setWindows] = useState<string[]>(['', '', '']);
  const [future, setFuture] = useState<FutureChoice>('none');
  const [showLayers, setShowLayers] = useState(false);
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

  return (
    <View style={{ gap: 12 }}>
      <DssatHeader theme={theme} title="Meu talhão no DSSAT" onBack={onBack} />
      <PointInfo theme={theme} farm={activeFarm} />

      {catalogError ? (
        <Card theme={theme} tone="danger">
          <P theme={theme}>{catalogError}</P>
          <Pressable onPress={reload} accessibilityRole="button">
            <Text style={{ color: theme.dangerText, fontWeight: '800' }}>Tentar carregar de novo</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* -------- formulário -------- */}
      <Card theme={theme}>
        <H theme={theme}>1. Cultura</H>
        <P theme={theme} muted>
          {loading ? 'Carregando o catálogo do simulador…' : 'Escolha uma cultura do simulador (variedade padrão do catálogo).'}
        </P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {crops.map((c) => (
            <Chip key={c.code} theme={theme} label={c.name} selected={crop === c.code} onPress={() => setCrop(c.code)} disabled={busy} />
          ))}
        </View>
      </Card>

      <Card theme={theme}>
        <H theme={theme}>2. Datas de plantio</H>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip theme={theme} label="Automático (pelo clima do local)" selected={autoWindows} onPress={() => setAutoWindows(true)} disabled={busy} />
          <Chip theme={theme} label="Escolher datas" selected={!autoWindows} onPress={() => setAutoWindows(false)} disabled={busy} />
        </View>
        {autoWindows ? (
          <P theme={theme} muted>
            O simulador usa o início do período mais chuvoso do local (estimativa — confira com o zoneamento agrícola, ZARC).
          </P>
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
      </Card>

      <Card theme={theme}>
        <H theme={theme}>3. Clima futuro (opcional)</H>
        <P theme={theme} muted>
          Compara o resultado de hoje com o clima projetado pela NASA para {period ?? 'meados do século'}.
        </P>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip theme={theme} label="Só clima atual" selected={future === 'none'} onPress={() => setFuture('none')} disabled={busy} />
          {Object.entries(scenarios).map(([id, label]) => (
            <Chip key={id} theme={theme} label={label} selected={future === id} onPress={() => setFuture(id)} disabled={busy || !period} />
          ))}
        </View>
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

      {result?.scenario_summary ? <SimulationView result={result} theme={theme} showLayers={showLayers} onToggleLayers={() => setShowLayers((v) => !v)} /> : null}
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
  showLayers: boolean;
  onToggleLayers: () => void;
}> = ({ result, theme, showLayers, onToggleLayers }) => {
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
          <P theme={theme}>
            Textura {soil.texture} • pH {soil.ph ?? 'sem dado'} • carbono orgânico {soil.organicCarbonPct ?? 'sem dado'}% • argila{' '}
            {soil.clayPct ?? 'sem dado'}% na superfície.
          </P>
          <P theme={theme}>
            Água que o solo segura para a planta até 1 m: cerca de <Text style={{ fontWeight: '900' }}>{soil.waterMm1m} mm</Text>{' '}
            ({soil.waterMm1m < 80 ? 'pouca — a lavoura sente rápido a falta de chuva' : soil.waterMm1m < 140 ? 'média' : 'boa'}).
          </P>
          <P theme={theme} muted>
            Fonte: {result.soil?.source ?? 'PronaSolos'}{soil.measured ? ' (com dados de laudo)' : ''}. Perfil até {soil.depthCm} cm.
          </P>
          {result.soil?.warnings?.map((w, i) => (
            <Text key={i} style={{ color: theme.warningText, fontSize: 12 * theme.scale }}>⚠ {w}</Text>
          ))}
          <Pressable onPress={onToggleLayers} accessibilityRole="button">
            <Text style={{ color: theme.primary, fontWeight: '800' }}>{showLayers ? 'Esconder camadas' : 'Ver camadas do solo'}</Text>
          </Pressable>
          {showLayers
            ? result.soil?.layers?.map((L, i) => (
                <Text key={i} style={{ color: theme.textMuted, fontSize: 11.5 * theme.scale }}>
                  até {L.SLB} cm: argila {L.SLCL ?? '–'}% • silte {L.SLSI ?? '–'}% • densidade {L.SBDM?.toFixed(2) ?? '–'} •
                  água útil {L.SDUL !== undefined && L.SLLL !== undefined ? ((L.SDUL - L.SLLL) * 100).toFixed(1) : '–'}% • pH{' '}
                  {L.SLHW ?? '–'}
                </Text>
              ))
            : null}
        </Card>
      ) : null}

      {/* Resultado por janela */}
      <Card theme={theme}>
        <H theme={theme}>
          {result.crop?.name ?? 'Cultura'} — {product}
        </H>
        <P theme={theme} muted>
          Variedade {result.crop?.cultivar?.name ?? 'padrão'} • {nYears ?? '?'} safras simuladas com o clima de{' '}
          {result.climate?.period?.[0]?.slice(0, 4) ?? '1991'}–{result.climate?.period?.[1]?.slice(0, 4) ?? '2025'}.
          {result.planting_windows_source ? ` Datas: ${result.planting_windows_source}.` : ''}
        </P>
        {result.scenario_summary?.map((s) => (
          <View
            key={s.trno}
            style={{
              borderWidth: 1.5,
              borderRadius: 12,
              padding: 10,
              gap: 3,
              borderColor: best && s.trno === best.trno ? theme.successBorder : theme.border,
              backgroundColor: best && s.trno === best.trno ? theme.successBg : 'transparent',
            }}
          >
            <Text style={{ fontWeight: '900', color: theme.text, fontSize: 13.5 * theme.scale }}>
              {s.name}
              {best && s.trno === best.trno ? '  ★ melhor no sequeiro' : ''}
            </Text>
            <P theme={theme}>
              Produção típica {fmtKg(s.yield_kg_ha.p50)} (ano ruim {fmtKg(s.yield_kg_ha.p10)} • ano bom {fmtKg(s.yield_kg_ha.p90)})
            </P>
            <P theme={theme} muted>
              Safras abaixo de 1.000 kg/ha: {fmtPct(s.share_seasons_below_1000_kg_ha)} • chuva no ciclo{' '}
              {s.rain_mm_p50 ?? 'sem dado'} mm{s.irrigated ? ` • irrigação ${s.irrigation_mm_p50 ?? 'sem dado'} mm` : ''} • ciclo{' '}
              {s.maturity_dap_p50 ?? 'sem dado'} dias
            </P>
          </View>
        ))}
        <P theme={theme} muted>
          “Ano ruim/bom” = 10% piores/melhores safras simuladas. É comparação entre datas e manejo, não previsão da próxima safra.
        </P>
      </Card>

      {/* Clima futuro */}
      {cp ? <ProjectionView cp={cp} theme={theme} running={result.status === 'running'} /> : null}

      {result.assumptions ? (
        <Card theme={theme}>
          <H theme={theme}>Premissas da simulação</H>
          {Object.values(result.assumptions).map((a, i) => (
            <P key={i} theme={theme} muted>• {a}</P>
          ))}
        </Card>
      ) : null}
    </View>
  );
};

const ProjectionView: React.FC<{
  cp: NonNullable<SimulationResult['climate_projection']>;
  theme: ReturnType<typeof getAppTheme>;
  running: boolean;
}> = ({ cp, theme, running }) => {
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
  return (
    <Card theme={theme} tone="success">
      <H theme={theme}>
        Clima futuro {cp.period} — {cp.scenario_name ?? cp.scenario}
      </H>
      <SourceBadge theme={theme} text="Projeção NASA NEX-GDDP-CMIP6 aplicada ao clima NASA POWER do local" />
      {models.map((m) => (
        <P key={m.model} theme={theme}>
          {m.model}: temperatura máx. {fmtDelta(m.climate_change?.tmax_change_c)} °C • chuva{' '}
          {fmtSignedPct(m.climate_change?.rain_change_pct)} • sol {fmtSignedPct(m.climate_change?.srad_change_pct)}
        </P>
      ))}
      {(cp.ensemble ?? []).map((e) => (
        <View key={e.trno} style={{ borderWidth: 1.5, borderRadius: 12, padding: 10, gap: 2, borderColor: theme.successBorder }}>
          <Text style={{ fontWeight: '900', color: theme.text, fontSize: 13.5 * theme.scale }}>{e.name}</Text>
          <P theme={theme}>
            Hoje {fmtKg(e.baseline_yield_p50)} → futuro {fmtKg(e.future_yield_p50_median)} (
            <Text style={{ fontWeight: '900', color: (e.yield_change_pct ?? 0) < 0 ? theme.dangerText : theme.successText }}>
              {fmtSignedPct(e.yield_change_pct)}
            </Text>
            )
          </P>
          <P theme={theme} muted>
            {e.models_with_loss ?? 0} de {e.n_models} modelo{e.n_models === 1 ? '' : 's'} indica{e.n_models === 1 ? '' : 'm'} perda
            {e.future_yield_p50_range && e.n_models > 1 ? ` • faixa ${fmtKg(e.future_yield_p50_range[0])} a ${fmtKg(e.future_yield_p50_range[1])}` : ''}
          </P>
        </View>
      ))}
      <P theme={theme} muted>
        {n < 3 ? `Por enquanto ${n} modelo${n === 1 ? '' : 's'} pronto${n === 1 ? '' : 's'}; os outros entram quando a NASA terminar de ser processada. ` : ''}
        Tendência de longo prazo, não previsão de um ano específico. CO₂ no nível atual; a ordem dos anos secos é a observada.
      </P>
    </Card>
  );
};

function fmtDelta(v?: number) {
  if (v === undefined || v === null || !Number.isFinite(v)) return 'sem dado';
  return `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}`;
}
