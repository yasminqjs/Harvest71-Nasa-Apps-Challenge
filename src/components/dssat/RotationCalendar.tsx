import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { friendlyMessage, planRotationCalendar, type RotationCalendarResult } from '../../services/dssatApi';
import type { CatalogCrop } from '../../types/dssat';
import { Card, Chip, H, P, PrimaryButton, dssatStyles } from './DssatShared';
import type { getAppTheme } from '../../theme/tokens';

const DAY = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

function tomorrow() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function RotationCalendar({ crops, theme }: { crops: CatalogCrop[]; theme: ReturnType<typeof getAppTheme> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState(() => [iso(tomorrow()), iso(tomorrow() + 180 * DAY), '']);
  const [result, setResult] = useState<RotationCalendarResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const plantingDates = [...new Set(dates.filter(Boolean))].sort();
  const validDates = plantingDates.length >= 2 && plantingDates.every((date) => {
    const time = Date.parse(date);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(time) && iso(time) === date &&
      time >= tomorrow() && time <= tomorrow() + 365 * DAY;
  });
  const windowCount = selected.length * plantingDates.length;

  async function submit() {
    if (busy || !validDates || selected.length < 2 || windowCount > 60) return;
    setBusy(true);
    setResult(undefined);
    setError('');
    try {
      setResult(await planRotationCalendar({
        horizon_start: plantingDates[0],
        horizon_end: iso(Date.parse(plantingDates[plantingDates.length - 1]) + 730 * DAY),
        known_crops: selected,
        windows: plantingDates.flatMap((planting_date) => selected.map((crop) => ({ crop, planting_date }))),
        max_cycles: plantingDates.length,
      }));
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Card theme={theme}>
        <H theme={theme}>Culturas para os próximos plantios</H>
        <P theme={theme}>Escolha pelo menos duas culturas e informe duas ou três datas futuras no próximo ano.</P>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {crops.map((crop) => (
            <Chip key={crop.code} theme={theme} label={crop.name} selected={selected.includes(crop.code)} disabled={busy}
              onPress={() => {
                setResult(undefined);
                setError('');
                setSelected((current) => current.includes(crop.code) ? current.filter((code) => code !== crop.code) : [...current, crop.code]);
              }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {dates.map((date, index) => (
            <TextInput key={index} value={date} editable={!busy} placeholder="AAAA-MM-DD"
              placeholderTextColor={theme.textMuted} accessibilityLabel={`Data futura de plantio ${index + 1}`}
              maxLength={10}
              style={[dssatStyles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
              onChangeText={(value) => {
                setResult(undefined);
                setError('');
                setDates((current) => current.map((item, i) => i === index ? value.trim() : item));
              }} />
          ))}
        </View>
        {!validDates && <P theme={theme}>Informe pelo menos duas datas futuras distintas no formato AAAA-MM-DD.</P>}
        {windowCount > 60 && <P theme={theme}>Com três datas, selecione até 20 culturas. Com duas datas, você pode selecionar todas.</P>}
      </Card>
      <PrimaryButton theme={theme} icon="calendar-outline" label={busy ? 'Montando calendário…' : 'Montar calendário'}
        disabled={busy || !validDates || selected.length < 2 || windowCount > 60} onPress={submit} />
      {error && <Card theme={theme} tone="danger"><P theme={theme}>{error}</P></Card>}
      {result && (
        <Card theme={theme}>
          <H theme={theme}>Calendários possíveis</H>
          <P theme={theme}>Estimativas com a duração de referência de cada cultura. Este modo avalia as datas e a sobreposição dos ciclos.</P>
          {result.candidates.length === 0 && <P theme={theme}>Nenhum ciclo coube nas datas informadas.</P>}
          {result.candidates.map(({ cycles }, index) => (
            <View key={index} style={{ gap: 4 }}>
              <H theme={theme}>{`Opção ${index + 1}`}</H>
              {cycles.map((cycle) => (
                <P key={cycle.planting_date} theme={theme}>
                  {crops.find((crop) => crop.code === cycle.crop)?.name ?? cycle.crop}
                  {' · '}{cycle.planting_date.split('-').reverse().join('/')} até {cycle.end_date.split('-').reverse().join('/')}
                </P>
              ))}
            </View>
          ))}
          {result.truncated && <P theme={theme}>Existem outras opções além das exibidas.</P>}
        </Card>
      )}
    </View>
  );
}
