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
    bg: '#F6F4EC',
    surface: '#FFFFFF',
    surfaceMuted: '#EFECE1',
    border: '#D5CFC0',
    text: '#16211A',
    textMuted: '#4A5A50',
    primary: '#166534',
    primaryText: '#FFFFFF',
    accent: '#0D9488',
    warningBg: '#FEF9C3',
    warningBorder: '#D97706',
    warningText: '#854D0E',
    dangerBg: '#FEE2E2',
    dangerBorder: '#DC2626',
    dangerText: '#991B1B',
    successBg: '#DCFCE7',
    successBorder: '#16A34A',
    successText: '#14532D',
    scale,
  };
}
