export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgInput: string;
  bgTranslation: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  recording: string;
  processing: string;
  border: string;
  neonGlow: string | undefined;
  statusBar: 'light' | 'dark';
  buttonText: string;
  modalOverlay: string;
}

export type ThemeName = 'monochrome' | 'neonTron';

export const monochrome: ThemeColors = {
  bg: '#ffffff',
  bgCard: '#f3f4f6',
  bgInput: '#e5e7eb',
  bgTranslation: '#e0e7ff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  accent: '#111827',
  accentText: '#4338ca',
  danger: '#dc2626',
  recording: '#dc2626',
  processing: '#9ca3af',
  border: '#e5e7eb',
  neonGlow: undefined,
  statusBar: 'dark',
  buttonText: '#ffffff',
  modalOverlay: 'rgba(0,0,0,0.3)',
};

export const neonTron: ThemeColors = {
  bg: '#0a0a0f',
  bgCard: '#12121a',
  bgInput: '#1a1a2e',
  bgTranslation: '#0d1b2a',
  textPrimary: '#e0e0e0',
  textSecondary: '#7f8c9b',
  textMuted: '#4a5568',
  accent: '#00fff0',
  accentText: '#00fff0',
  danger: '#ff0055',
  recording: '#ff00ff',
  processing: '#2d2d44',
  border: 'rgba(0, 255, 240, 0.25)',
  neonGlow: '#00fff0',
  statusBar: 'light',
  buttonText: '#0a0a0f',
  modalOverlay: 'rgba(0,0,0,0.7)',
};

export const themes: Record<ThemeName, ThemeColors> = {
  monochrome,
  neonTron,
};
