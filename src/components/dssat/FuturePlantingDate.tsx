import React, { useState } from 'react';
import { View } from 'react-native';
import type { getAppTheme } from '../../theme/tokens';
import { useLanguage, type Language } from '../../i18n/Language';
import { Card, Chip, H, P } from './DssatShared';

export const DAY = 86_400_000;
export const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
export function shortDate(date: string, language: Language) {
  return new Date(date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function tomorrow() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function FuturePlantingDate({ value, min, max, label, disabled, theme, onChange }: {
  value: string; min: number; max: number; label: string; disabled: boolean;
  theme: ReturnType<typeof getAppTheme>; onChange: (value: string) => void;
}) {
  const { language } = useLanguage();
  const en = language === 'en';
  const [month, setMonth] = useState<number>();
  const current = new Date(Math.min(max, Math.max(min, month ?? (Date.parse(value) || min))));
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const first = Date.UTC(y, m, 1);
  const next = Date.UTC(y, m + 1, 1);
  const days = Array.from({ length: (next - first) / DAY }, (_, i) => first + i * DAY);

  return (
    <View style={{ gap: 6 }}>
      <Chip
        theme={theme}
        label={`${label}: ${value ? shortDate(value, language) : en ? 'Pick date' : 'Escolher data'}`}
        selected={month !== undefined}
        disabled={disabled}
        onPress={() => setMonth(month === undefined ? first : undefined)}
      />
      {month !== undefined && (
        <Card theme={theme}>
          <H theme={theme}>{current.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip theme={theme} label={en ? 'Previous month' : 'Mês anterior'} selected={false} disabled={disabled || first <= min} onPress={() => setMonth(Date.UTC(y, m - 1, 1))} />
            <Chip theme={theme} label={en ? 'Next month' : 'Próximo mês'} selected={false} disabled={disabled || next > max} onPress={() => setMonth(next)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {days.filter((day) => day >= min && day <= max).map((day) => (
              <Chip key={day} theme={theme} label={String(new Date(day).getUTCDate())} disabled={disabled}
                selected={isoDay(day) === value} onPress={() => { onChange(isoDay(day)); setMonth(undefined); }} />
            ))}
          </View>
          <P theme={theme} muted>
            {en ? 'Select an available day in this month.' : 'Selecione um dia disponível neste mês.'}
          </P>
        </Card>
      )}
    </View>
  );
}
