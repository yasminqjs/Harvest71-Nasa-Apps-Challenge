import React from 'react';
import { TextInput } from 'react-native';

export interface CropDateInputProps {
  accessibilityLabel: string;
  value?: string;
  minimumDate?: string;
  maximumDate?: string;
  onChange: (value?: string) => void;
}

export const CropDateInput: React.FC<CropDateInputProps> = ({
  accessibilityLabel,
  value,
  onChange,
}) => (
  <TextInput
    accessibilityLabel={accessibilityLabel}
    value={value ?? ''}
    onChangeText={(text) => onChange(text || undefined)}
    placeholder="AAAA-MM-DD"
    style={{ minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9 }}
  />
);