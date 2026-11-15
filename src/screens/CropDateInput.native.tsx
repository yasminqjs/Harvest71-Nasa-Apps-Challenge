import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CropDateInputProps } from './CropDateInput';

function parseDate(value?: string): Date {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString('pt-BR');
}

export const CropDateInput: React.FC<CropDateInputProps> = ({
  accessibilityLabel,
  value,
  minimumDate,
  maximumDate,
  onChange,
}) => {
  const [iosPickerVisible, setIosPickerVisible] = useState(false);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseDate(value),
        mode: 'date',
        minimumDate: minimumDate ? parseDate(minimumDate) : undefined,
        maximumDate: maximumDate ? parseDate(maximumDate) : undefined,
        onValueChange: (_event, date) => {
          if (date) onChange(toDateValue(date));
        },
      });
    } else {
      setIosPickerVisible((visible) => !visible);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={styles.dateButton}
        >
          <Text style={styles.dateText}>{value ? formatDate(value) : 'Selecionar data'}</Text>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => onChange(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Limpar data"
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>Limpar</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'ios' && iosPickerVisible ? (
        <View>
          <DateTimePicker
            value={parseDate(value)}
            mode="date"
            display="spinner"
            minimumDate={minimumDate ? parseDate(minimumDate) : undefined}
            maximumDate={maximumDate ? parseDate(maximumDate) : undefined}
            onValueChange={(_event, date) => {
              if (date) onChange(toDateValue(date));
            }}
          />
          <Pressable onPress={() => setIosPickerVisible(false)} style={styles.doneButton}>
            <Text style={styles.doneText}>Concluído</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateButton: { minHeight: 42, flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: '#6C6658', borderRadius: 9, paddingHorizontal: 9 },
  dateText: { fontSize: 12, color: '#19221C', fontWeight: '700' },
  clearButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 7 },
  clearText: { fontSize: 11, color: '#991B1B', fontWeight: '800' },
  doneButton: { alignItems: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 },
  doneText: { color: '#1B6B40', fontWeight: '900' },
});