import React from 'react';
import { CropDateInputProps } from './CropDateInput';

export const CropDateInput: React.FC<CropDateInputProps> = ({
  accessibilityLabel,
  value,
  minimumDate,
  maximumDate,
  onChange,
}) => (
  <input
    aria-label={accessibilityLabel}
    type="date"
    value={value ?? ''}
    min={minimumDate}
    max={maximumDate}
    onChange={(event) => onChange(event.currentTarget.value || undefined)}
    style={{
      boxSizing: 'border-box',
      width: '100%',
      minHeight: 42,
      padding: '0 9px',
      border: '1px solid #6C6658',
      borderRadius: 9,
      backgroundColor: 'transparent',
      color: 'inherit',
      font: 'inherit',
    }}
  />
);