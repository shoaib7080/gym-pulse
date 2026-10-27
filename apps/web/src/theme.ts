/**
 * GymPulse Admin Dashboard Suite - Centralized Theming Engine
 * Single file defining all design tokens, color modes, and extensible themes.
 * Easily modify tokens here or add new theme options.
 */

export interface ColorTokens {
  // Brand & Action
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  primaryFixed: string;
  primaryFixedDim: string;

  // Secondary (Telemetry & Stats)
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;
  secondaryFixed: string;

  // Tertiary (Alerts & Accents)
  tertiary: string;
  tertiaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;

  // Surfaces & Backgrounds
  background: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceLowest: string;
  surfaceLow: string;
  surfaceDefault: string;
  surfaceHigh: string;
  surfaceHighest: string;
  surfaceVariant: string;

  // Text & Borders
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;

  // Status
  error: string;
  errorContainer: string;
  onError: string;
  success: string;
  warning: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colorMode: 'dark' | 'light';
  fontFamily: string;
  colors: ColorTokens;
  radii: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  glows: {
    primary: string;
    secondary: string;
    card: string;
  };
}

/**
 * 1. Default Design System: Kinetic Obsidian (From Stitch Project)
 * Athletic vitality disciplined by institutional precision.
 */
export const kineticObsidian: ThemeConfig = {
  id: 'kinetic-obsidian',
  name: 'Kinetic Obsidian (Official)',
  description: 'Athletic dark obsidian canvas with electric lime & cyan telemetry',
  colorMode: 'dark',
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
  colors: {
    primary: '#9ee939',
    primaryHover: '#acf847',
    primaryActive: '#65a30d',
    primaryContainer: '#84cc16',
    onPrimary: '#1f3700',
    onPrimaryContainer: '#315200',
    primaryFixed: '#acf847',
    primaryFixedDim: '#91db2a',

    secondary: '#4cd7f6',
    secondaryContainer: '#03b5d3',
    onSecondary: '#003640',
    onSecondaryContainer: '#00424e',
    secondaryFixed: '#acedff',

    tertiary: '#ffc9ae',
    tertiaryContainer: '#ffa270',
    onTertiary: '#552100',
    onTertiaryContainer: '#7c3300',

    background: '#0b1326',
    surface: '#0b1326',
    surfaceDim: '#0b1326',
    surfaceBright: '#31394d',
    surfaceLowest: '#060e20',
    surfaceLow: '#131b2e',
    surfaceDefault: '#171f33',
    surfaceHigh: '#222a3d',
    surfaceHighest: '#2d3449',
    surfaceVariant: '#2d3449',

    onSurface: '#dae2fd',
    onSurfaceVariant: '#c1cab0',
    outline: '#8b947d',
    outlineVariant: 'rgba(66, 73, 54, 0.4)',
    inverseSurface: '#dae2fd',
    inverseOnSurface: '#283044',

    error: '#ffb4ab',
    errorContainer: '#93000a',
    onError: '#690005',
    success: '#10b981',
    warning: '#f97316',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  glows: {
    primary: '0 0 20px -3px rgba(158, 233, 57, 0.35)',
    secondary: '0 0 20px -3px rgba(76, 215, 246, 0.25)',
    card: '0 10px 25px -5px rgba(6, 14, 32, 0.6)',
  },
};

/**
 * 2. Cyber Emerald Alternative Theme
 */
export const cyberEmerald: ThemeConfig = {
  id: 'cyber-emerald',
  name: 'Cyber Emerald',
  description: 'Deep racing teal with neon mint & energetic amber highlights',
  colorMode: 'dark',
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
  colors: {
    primary: '#10b981',
    primaryHover: '#34d399',
    primaryActive: '#059669',
    primaryContainer: '#059669',
    onPrimary: '#022c22',
    onPrimaryContainer: '#a7f3d0',
    primaryFixed: '#6ee7b7',
    primaryFixedDim: '#34d399',

    secondary: '#38bdf8',
    secondaryContainer: '#0284c7',
    onSecondary: '#082f49',
    onSecondaryContainer: '#bae6fd',
    secondaryFixed: '#7dd3fc',

    tertiary: '#fbbf24',
    tertiaryContainer: '#d97706',
    onTertiary: '#451a03',
    onTertiaryContainer: '#fef3c7',

    background: '#041315',
    surface: '#041315',
    surfaceDim: '#030f10',
    surfaceBright: '#164e63',
    surfaceLowest: '#020b0c',
    surfaceLow: '#082024',
    surfaceDefault: '#0e2d33',
    surfaceHigh: '#153b42',
    surfaceHighest: '#1e4850',
    surfaceVariant: '#1e4850',

    onSurface: '#e6fffa',
    onSurfaceVariant: '#99f6e4',
    outline: '#2dd4bf',
    outlineVariant: 'rgba(45, 212, 191, 0.3)',
    inverseSurface: '#e6fffa',
    inverseOnSurface: '#134e4a',

    error: '#f87171',
    errorContainer: '#991b1b',
    onError: '#450a0a',
    success: '#10b981',
    warning: '#f59e0b',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  glows: {
    primary: '0 0 20px -3px rgba(16, 185, 129, 0.35)',
    secondary: '0 0 20px -3px rgba(56, 189, 248, 0.25)',
    card: '0 10px 25px -5px rgba(2, 11, 12, 0.6)',
  },
};

/**
 * 3. Midnight Ultra Alternative Theme
 */
export const midnightUltra: ThemeConfig = {
  id: 'midnight-ultra',
  name: 'Midnight Electric',
  description: 'Jet black with ultraviolet & electric cyan highlights',
  colorMode: 'dark',
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
  colors: {
    primary: '#a855f7',
    primaryHover: '#c084fc',
    primaryActive: '#7e22ce',
    primaryContainer: '#9333ea',
    onPrimary: '#2e1065',
    onPrimaryContainer: '#f3e8ff',
    primaryFixed: '#d8b4fe',
    primaryFixedDim: '#c084fc',

    secondary: '#06b6d4',
    secondaryContainer: '#0891b2',
    onSecondary: '#164e63',
    onSecondaryContainer: '#cffafe',
    secondaryFixed: '#67e8f9',

    tertiary: '#f43f5e',
    tertiaryContainer: '#e11d48',
    onTertiary: '#4c0519',
    onTertiaryContainer: '#ffe4e6',

    background: '#09090b',
    surface: '#09090b',
    surfaceDim: '#09090b',
    surfaceBright: '#27272a',
    surfaceLowest: '#000000',
    surfaceLow: '#121217',
    surfaceDefault: '#18181b',
    surfaceHigh: '#27272a',
    surfaceHighest: '#3f3f46',
    surfaceVariant: '#3f3f46',

    onSurface: '#fafafa',
    onSurfaceVariant: '#a1a1aa',
    outline: '#71717a',
    outlineVariant: 'rgba(113, 113, 122, 0.3)',
    inverseSurface: '#fafafa',
    inverseOnSurface: '#18181b',

    error: '#f87171',
    errorContainer: '#7f1d1d',
    onError: '#450a0a',
    success: '#22c55e',
    warning: '#f97316',
  },
  radii: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  glows: {
    primary: '0 0 20px -3px rgba(168, 85, 247, 0.35)',
    secondary: '0 0 20px -3px rgba(6, 182, 212, 0.25)',
    card: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
  },
};

export const AVAILABLE_THEMES: Record<string, ThemeConfig> = {
  'kinetic-obsidian': kineticObsidian,
  'cyber-emerald': cyberEmerald,
  'midnight-ultra': midnightUltra,
};

export const DEFAULT_THEME = kineticObsidian;

/**
 * Apply the theme tokens to CSS custom variables in the document root.
 * This guarantees any Tailwind class or CSS referencing var(--color-*) reacts immediately.
 */
export function applyThemeToDocument(theme: ThemeConfig = DEFAULT_THEME): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Colors
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-primary-hover', theme.colors.primaryHover);
  root.style.setProperty('--color-primary-active', theme.colors.primaryActive);
  root.style.setProperty('--color-primary-container', theme.colors.primaryContainer);
  root.style.setProperty('--color-on-primary', theme.colors.onPrimary);
  root.style.setProperty('--color-on-primary-container', theme.colors.onPrimaryContainer);
  root.style.setProperty('--color-primary-fixed', theme.colors.primaryFixed);
  root.style.setProperty('--color-primary-fixed-dim', theme.colors.primaryFixedDim);

  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-secondary-container', theme.colors.secondaryContainer);
  root.style.setProperty('--color-on-secondary', theme.colors.onSecondary);
  root.style.setProperty('--color-on-secondary-container', theme.colors.onSecondaryContainer);
  root.style.setProperty('--color-secondary-fixed', theme.colors.secondaryFixed);

  root.style.setProperty('--color-tertiary', theme.colors.tertiary);
  root.style.setProperty('--color-tertiary-container', theme.colors.tertiaryContainer);
  root.style.setProperty('--color-on-tertiary', theme.colors.onTertiary);
  root.style.setProperty('--color-on-tertiary-container', theme.colors.onTertiaryContainer);

  root.style.setProperty('--color-background', theme.colors.background);
  root.style.setProperty('--color-surface', theme.colors.surface);
  root.style.setProperty('--color-surface-dim', theme.colors.surfaceDim);
  root.style.setProperty('--color-surface-bright', theme.colors.surfaceBright);
  root.style.setProperty('--color-surface-container-lowest', theme.colors.surfaceLowest);
  root.style.setProperty('--color-surface-container-low', theme.colors.surfaceLow);
  root.style.setProperty('--color-surface-container', theme.colors.surfaceDefault);
  root.style.setProperty('--color-surface-container-high', theme.colors.surfaceHigh);
  root.style.setProperty('--color-surface-container-highest', theme.colors.surfaceHighest);
  root.style.setProperty('--color-surface-variant', theme.colors.surfaceVariant);

  root.style.setProperty('--color-on-surface', theme.colors.onSurface);
  root.style.setProperty('--color-on-surface-variant', theme.colors.onSurfaceVariant);
  root.style.setProperty('--color-outline', theme.colors.outline);
  root.style.setProperty('--color-outline-variant', theme.colors.outlineVariant);
  root.style.setProperty('--color-inverse-surface', theme.colors.inverseSurface);
  root.style.setProperty('--color-inverse-on-surface', theme.colors.inverseOnSurface);

  root.style.setProperty('--color-error', theme.colors.error);
  root.style.setProperty('--color-error-container', theme.colors.errorContainer);
  root.style.setProperty('--color-on-error', theme.colors.onError);
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-warning', theme.colors.warning);

  // Glows & Shadows
  root.style.setProperty('--glow-primary', theme.glows.primary);
  root.style.setProperty('--glow-secondary', theme.glows.secondary);
  root.style.setProperty('--shadow-card', theme.glows.card);

  // Border Radii
  root.style.setProperty('--radius-sm', theme.radii.sm);
  root.style.setProperty('--radius-md', theme.radii.md);
  root.style.setProperty('--radius-lg', theme.radii.lg);
  root.style.setProperty('--radius-xl', theme.radii.xl);

  // Data attribute on root for styling hooks
  root.setAttribute('data-theme', theme.id);
  if (theme.colorMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
