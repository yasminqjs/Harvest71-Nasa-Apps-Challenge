import { AccessibilityProfile } from '../types/domain';

export interface AppTheme {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;
  successBg: string;
  successBorder: string;
  successText: string;
  scale: number;
}

export function getAppTheme(acc: AccessibilityProfile): AppTheme {
  const scale = acc.largeText ? 1.18 : 1.0;

  if (acc.highContrast) {
    return {
      bg: '#0D1117',
      surface: '#161B22',
      surfaceMuted: '#21262D',
      border: '#FFD60A',
      text: '#FFFFFF',
      textMuted: '#E6EDF3',
      primary: '#FFD60A',
      primaryText: '#0D1117',
      accent: '#38BDF8',
      warningBg: '#3B2F00',
      warningBorder: '#FFD60A',
      warningText: '#FFE566',
      dangerBg: '#450A0A',
      dangerBorder: '#FF6B6B',
      dangerText: '#FFD1D1',
      successBg: '#063B27',
      successBorder: '#4ADE80',
      successText: '#BBF7D0',
      scale,
    };
  }

  return {
    bg: '#F7F5EE',
    surface: '#FFFFFF',
    surfaceMuted: '#EFECE2',
    border: '#1F2937',
    text: '#1B1F23',
    textMuted: '#4B5563',
    primary: '#1F6E43',
    primaryText: '#FFFFFF',
    accent: '#0E7490',
    warningBg: '#FEF3C7',
    warningBorder: '#D97706',
    warningText: '#92400E',
    dangerBg: '#FEE2E2',
    dangerBorder: '#DC2626',
    dangerText: '#991B1B',
    successBg: '#DCFCE7',
    successBorder: '#16A34A',
    successText: '#14532D',
    scale,
  };
}
