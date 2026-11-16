import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useLanguage } from '../../i18n/Language';
import { Pressable, Text, TextInput } from '../../i18n/native';
import { translate } from '../../i18n/translate';
import { useDssatJob } from '../../hooks/useDssatJob';
import { createRotationSearch } from '../../services/dssatApi';
import type { getAppTheme } from '../../theme/tokens';
import type { GeoPoint } from '../../types/domain';
import type { Capabilities, CatalogCrop, RotationSearchResult } from '../../types/dssat';
import { eligibleInSelection, targetMetric, validateSearchForm } from '../../utils/dssatLogic';
import { VoiceReadBar } from '../VoiceReadBar';
import { Card, ExpandableDetails, H, JobStatusBox, P, PrimaryButton, dssatStyles } from './DssatShared';
import { GoalAttainmentCard } from './DssatVisualCharts';
import { DAY } from './FuturePlantingDate';

export function RotationGoalSearch({
  selected,
  dates,
  caps,
  crops,
  theme,
  point,
  areaKey,
  onAddThirdDate,
  onSpaceDates,
}: {
  selected: string[];
  dates: string[];
  caps: Capabilities;
  crops: CatalogCrop[];
  theme: ReturnType<typeof getAppTheme>;
  point: GeoPoint;
  areaKey: string;
  onAddThirdDate?: () => void;
  onSpaceDates?: () => void;
}) {
  const { speak } = useAccessibility();
  const { language } = useLanguage();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const job = useDssatJob<RotationSearchResult>(areaKey, 'rotation_search');
  const spokenIdRef = useRef<string | null>(null);
  const eligible = eligibleInSelection(selected, caps);
  const leapDate = dates.find((date) => date.endsWith('-02-29'));
  const leapOffset = leapDate ? Number(leapDate.slice(0, 4)) - Number(dates[0].slice(0, 4)) : 0;
  const years = leapDate ? [2012 - leapOffset, 2020 - leapOffset] : [2015, 2020];
  const errors = validateSearchForm({ selected, eligible, dates, years, targets });
  const name = (code: string) => {
    const raw = crops.find((crop) => crop.code === code)?.name ?? code;
    return language === 'en' ? translate(raw, 'en') : raw;
  };
  const biomass = [...eligible].filter((code) => targetMetric(code, caps) === 'biomass_kg_ha');
  const result = job.state.phase === 'done' ? job.state.result : undefined;

  const hasPairs = eligible.size >= 2;
  const hasThreeDates = dates.length === 3;
  const targetsReady =
    hasPairs &&
    [...eligible].every((code) => {
      const n = Number((targets[code] ?? '').replace(',', '.').trim());
      return Number.isFinite(n) && n > 0;
    });

  const unpairedSelected = selected.filter((code) => !eligible.has(code));
  const en = language === 'en';
  const gapsDays = dates.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(dates[i])) / DAY));
  const minGapDays = gapsDays.length ? Math.min(...gapsDays) : 0;
  const tightSpacing = hasThreeDates && minGapDays > 0 && minGapDays < 145;

  const partialIncomplete = (result?.incomplete_alternatives ?? []).filter((item) => item.samples.length > 0);

  const searchSpeechText = (() => {
    if (!result) {
      if (en) {
        return `DSSAT Goal Search. ${eligible.size} crops form pairs, ${dates.length} of 3 planting dates selected.`;
      }
      return `Busca de rotações por meta no DSSAT. ${eligible.size} culturas formam par, ${dates.length} de 3 datas definidas.`;
    }
    const tested = result.search?.attempted_candidates ?? 0;
    const recs = result.recommendations ?? [];
    if (recs.length > 0) {
      const top = recs[0];
      const topNames = top.order.map(name).join(', ');
      const pct = Math.round((top.mean_target_attainment ?? 0) * 100);
      return en
        ? `DSSAT tested ${tested} orders and found ${recs.length} complete rotations. Best option: ${topNames}, reaching ${pct} percent of goals.`
        : `O DSSAT testou ${tested} ordens e encontrou ${recs.length} rotações completas. Melhor opção: ${topNames}, atingindo ${pct}% das metas.`;
    }
    return en
      ? `DSSAT tested ${tested} orders, but none completed all historical years. This usually happens when spacing between planting dates is under 145 days or a dry-season planting date prevents germination in one of the tested years.`
      : `O DSSAT testou ${tested} ordens, mas nenhuma completou os dois anos históricos. Isso acontece quando o intervalo entre plantios é curto, abaixo de 145 dias, ou quando uma data cai na estação seca e falha em 2015 ou 2020.`;
  })();

  useEffect(() => {
    if (!result || spokenIdRef.current === result.id) return;
    spokenIdRef.current = result.id;
    speak(searchSpeechText);
  }, [result, searchSpeechText, speak]);

  return (
    <Card theme={theme}>
      <H theme={theme}>
        {en ? 'Find Best Rotations by Yield Goal (DSSAT)' : 'Buscar Rotações por Meta (DSSAT)'}
      </H>

      {/* Crisp 3-step live readiness strip */}
      <View style={[styles.checkStrip, { borderColor: theme.border }]}>
        <CheckPill
          ok={hasPairs}
          text={en ? `Pairs (${eligible.size})` : `Pares (${eligible.size})`}
          theme={theme}
        />
        <CheckPill
          ok={hasThreeDates}
          text={en ? `Dates (${dates.length}/3)` : `Datas (${dates.length}/3)`}
          theme={theme}
        />
        <CheckPill
          ok={targetsReady}
          text={en ? 'Goals (kg/ha)' : 'Metas (kg/ha)'}
          theme={theme}
        />
      </View>

      {!hasThreeDates && (
        <View style={[styles.inlineAlert, { backgroundColor: theme.warningBg, borderColor: theme.warningBorder }]}>
          <Text style={{ fontSize: 12 * theme.scale, color: theme.warningText, fontWeight: '700', flex: 1 }}>
            {en
              ? 'DSSAT search needs 3 planting dates (across up to 2 years).'
              : 'A busca DSSAT precisa de 3 datas de plantio.'}
          </Text>
          {onAddThirdDate && (
            <Pressable
              onPress={onAddThirdDate}
              style={[styles.quickFixBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.primaryText }}>
                {en ? '+ Add 3rd date' : '+ 3ª data'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {!hasPairs && (
        <View style={[styles.inlineAlert, { backgroundColor: theme.warningBg, borderColor: theme.warningBorder }]}>
          <Text style={{ fontSize: 12 * theme.scale, color: theme.warningText, fontWeight: '700' }}>
            {selected.length === 0
              ? en
                ? 'Select at least 2 green-linked crops above to form a DSSAT pair.'
                : 'Selecione acima ao menos 2 culturas compatíveis (verdes) para formar um par.'
              : en
              ? 'Selected crops do not form an enabled DSSAT pair yet. Tap a green-highlighted crop above.'
              : 'As culturas escolhidas ainda não formam par no DSSAT. Toque em uma cultura destacada em verde acima.'}
          </Text>
        </View>
      )}

      {hasPairs && unpairedSelected.length > 0 && (
        <Text style={{ fontSize: 11 * theme.scale, color: theme.warningText }}>
          {en
            ? `Note: ${unpairedSelected.map(name).join(', ')} has no enabled pair with your other choices and won’t enter DSSAT.`
            : `Aviso: ${unpairedSelected.map(name).join(', ')} não forma par com as demais e ficará fora desta busca.`}
        </Text>
      )}

      {hasThreeDates && hasPairs && (
        <View style={{ gap: 6 }}>
          {[...eligible].map((code) => {
            const rawProd = crops.find((crop) => crop.code === code)?.product;
            const metric = biomass.includes(code)
              ? en
                ? 'dry biomass'
                : 'biomassa seca'
              : rawProd
              ? en
                ? translate(rawProd, 'en')
                : rawProd
              : en
              ? 'yield'
              : 'produto';
            const label = `${name(code)} · ${metric} (kg/ha)`;
            return (
              <View key={code} style={styles.goalRow}>
                <Text style={{ fontSize: 12.5 * theme.scale, fontWeight: '800', color: theme.text, flex: 1 }}>
                  {label}
                </Text>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="decimal-pad"
                  value={targets[code] ?? ''}
                  editable={!job.busy}
                  placeholder="kg/ha"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    dssatStyles.input,
                    styles.goalInput,
                    { borderColor: theme.border, color: theme.text, backgroundColor: theme.bg },
                  ]}
                  onChangeText={(value) => setTargets((current) => ({ ...current, [code]: value }))}
                />
              </View>
            );
          })}
        </View>
      )}

      {tightSpacing && (
        <View style={[styles.inlineAlert, { backgroundColor: theme.warningBg, borderColor: theme.warningBorder }]}>
          <Text style={{ fontSize: 11.5 * theme.scale, color: theme.warningText, flex: 1 }}>
            {en
              ? `Short gap (${minGapDays}d) between plantings: longer crops may overlap the next date in DSSAT.`
              : `Intervalo curto (${minGapDays}d) entre datas: ciclos longos podem sobrepor o plantio seguinte.`}
          </Text>
          {onSpaceDates && (
            <Pressable onPress={onSpaceDates} style={[styles.quickFixBtn, { backgroundColor: theme.primary }]}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primaryText }}>
                {en ? 'Space ~150d+' : 'Espaçar ~150d+'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {hasThreeDates && hasPairs && errors[0] && (
        <Text style={{ fontSize: 11.5 * theme.scale, color: theme.textMuted }}>
          {en ? translate(errors[0], 'en') : errors[0]}
        </Text>
      )}

      <PrimaryButton
        theme={theme}
        icon="search-outline"
        label={en ? 'Search rotations with DSSAT' : 'Buscar rotações com DSSAT'}
        disabled={errors.length > 0 || job.busy}
        onPress={() =>
          void job.submit(() =>
            createRotationSearch({
              lat: point.latitude,
              lon: point.longitude,
              known_crops: selected,
              planting_dates: dates as [string, string, string],
              historical_start_years: years,
              yield_targets_kg_ha: Object.fromEntries(
                [...eligible].map((code) => [code, Number(targets[code].replace(',', '.'))])
              ),
              biomass_target_crops: biomass,
              max_candidates: 8,
            })
          )
        }
      />

      <JobStatusBox theme={theme} state={job.state} onRetry={job.retry} onReset={job.reset} />

      {result && (
        <View style={{ gap: 8 }}>
          <VoiceReadBar
            text={searchSpeechText}
            theme={theme}
            label={en ? 'Read DSSAT result aloud' : 'Ouvir resultado da busca'}
          />
          <P theme={theme} muted>
            {en ? 'Orders tested:' : 'Ordens testadas:'}{' '}
            {result.search?.attempted_candidates ?? (en ? 'unavailable' : 'indisponível')}
            {typeof result.search?.calendar_filtered === 'number' && result.search.calendar_filtered > 0
              ? en
                ? ` • ${result.search.calendar_filtered} filtered by cycle duration`
                : ` • ${result.search.calendar_filtered} filtradas por duração do ciclo`
              : ''}
          </P>
        </View>
      )}
      {result && !result.recommendations?.length && (
        <View style={[styles.diagBox, { backgroundColor: theme.warningBg, borderColor: theme.warningBorder }]}>
          <P theme={theme} bold>
            {en ? 'No planting order completed both historical years.' : 'Nenhuma ordem completou a comparação nos 2 anos históricos.'}
          </P>
          <P theme={theme}>
            {en
              ? `DSSAT requires every crop in the sequence to plant and mature within the horizon in both ${years.join(' & ')}. Try spacing dates 150+ days apart, avoiding peak dry-season winter dates, or picking 2–3 crops so the 8-run budget focuses on wider cycles.`
              : `No modo por metas, o DSSAT exige que todas as colheitas da sequência fechem nos 2 anos históricos (${years.join(' e ')}). Intervalos curtos (${minGapDays}d), plantio no auge da seca (jul–ago) ou muitas culturas disputando as 8 tentativas fazem o ciclo falhar em ao menos um ano.`}
          </P>
          {onSpaceDates && (
            <Pressable
              onPress={onSpaceDates}
              style={[styles.quickFixBtn, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}
            >
              <Text style={{ fontSize: 11.5, fontWeight: '900', color: theme.primaryText }}>
                {en ? 'Apply wider planting dates (~150d+ gaps)' : 'Aplicar datas mais espaçadas (~150d+)'}
              </Text>
            </Pressable>
          )}
          {partialIncomplete.length > 0 && (
            <View style={{ gap: 4, marginTop: 2 }}>
              <P theme={theme} bold>
                {en ? 'Partial completions (1 historical year finished):' : 'Completaram parcialmente (1 ano histórico):'}
              </P>
              {partialIncomplete.slice(0, 3).map((item) => (
                <Text key={item.id} style={{ fontSize: 11.5 * theme.scale, color: theme.text }}>
                  • {item.order.map(name).join(' → ')} ({en ? 'failed in' : 'falhou em'}:{' '}
                  {(item.failed_years ?? []).join(', ')})
                </Text>
              ))}
            </View>
          )}
          {!!result.incomplete_alternatives?.length && (
            <ExpandableDetails
              theme={theme}
              label={
                en
                  ? `See ${result.incomplete_alternatives.length} tested sequences`
                  : `Ver as ${result.incomplete_alternatives.length} ordens que falharam`
              }
            >
              {result.incomplete_alternatives.map((item) => (
                <P key={item.id} theme={theme} muted>
                  • {item.order.map(name).join(' → ')} —{' '}
                  {item.samples.length
                    ? en
                      ? `${item.samples.length} yr ok, failed ${item.failed_years?.join(', ')}`
                      : `${item.samples.length} ano ok, falhou em ${item.failed_years?.join(', ')}`
                    : en
                    ? `failed in ${item.failed_years?.join(', ')}`
                    : `falhou em ${item.failed_years?.join(', ')}`}
                </P>
              ))}
            </ExpandableDetails>
          )}
        </View>
      )}
      {result?.recommendations?.map((option) => (
        <GoalAttainmentCard key={option.id} theme={theme} option={option} cropName={name} />
      ))}

      <ExpandableDetails
        theme={theme}
        label={en ? 'How goal search works' : 'Como funciona a busca por metas'}
      >
        <P theme={theme} muted>
          {en
            ? 'DSSAT tests up to eight crop orders using local historical weather and the month and day from your planting dates.'
            : 'O DSSAT testa até oito ordens com clima histórico, usando o mês e o dia dos plantios do plano.'}
        </P>
      </ExpandableDetails>
    </Card>
  );
}

const CheckPill: React.FC<{ ok: boolean; text: string; theme: ReturnType<typeof getAppTheme> }> = ({
  ok,
  text,
  theme,
}) => (
  <View
    style={[
      styles.checkPill,
      {
        backgroundColor: ok ? theme.successBg : theme.surfaceMuted,
        borderColor: ok ? theme.successBorder : theme.border,
      },
    ]}
  >
    <Ionicons
      name={ok ? 'checkmark-circle' : 'ellipse-outline'}
      size={13}
      color={ok ? theme.successText : theme.textMuted}
    />
    <Text style={{ fontSize: 11, fontWeight: '800', color: ok ? theme.successText : theme.textMuted }}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  checkStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4,
  },
  checkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  quickFixBtn: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalInput: {
    width: 105,
    minWidth: 96,
    paddingVertical: 6,
    textAlign: 'right',
  },
  diagBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
});
