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
    bg: '#F5F3EB',
    surface: '#FFFFFF',
    surfaceMuted: '#EAE6D9',
    border: '#6C6658',
    text: '#19221C',
    textMuted: '#4A554E',
    primary: '#1B6B40',
    primaryText: '#FFFFFF',
    accent: '#0F766E',
    warningBg: '#FEF5D4',
    warningBorder: '#D97706',
    warningText: '#854D0E',
    dangerBg: '#FEE8E8',
    dangerBorder: '#DC2626',
    dangerText: '#991B1B',
    successBg: '#DCFCE7',
    successBorder: '#15803D',
    successText: '#14532D',
    scale,
  };
}
