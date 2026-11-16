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
    bg: '#F4F4EE',
    surface: '#FFFFFF',
    surfaceMuted: '#EAECE4',
    border: '#DFE2D7',
    text: '#17251E',
    textMuted: '#526258',
    primary: '#23473B',
    primaryText: '#FFFFFF',
    accent: '#2E4756',
    warningBg: '#FEF9C3',
    warningBorder: '#D97706',
    warningText: '#854D0E',
    dangerBg: '#FEE2E2',
    dangerBorder: '#DC2626',
    dangerText: '#991B1B',
    successBg: '#E6EFE4',
    successBorder: '#3B6B4F',
    successText: '#173B27',
    scale,
  };
}
