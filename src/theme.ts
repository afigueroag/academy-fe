const DEFAULTS = {
  primary: '6366F1',
  secondary: '8B5CF6',
  accent: '06B6D4',
};

function withHash(color: string | null | undefined, fallback: string): string {
  const raw = (color ?? fallback).trim();
  return raw.startsWith('#') ? raw : '#' + raw;
}

export function applyTheme(colors: {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}): void {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', withHash(colors.primary_color, DEFAULTS.primary));
  root.style.setProperty('--color-secondary', withHash(colors.secondary_color, DEFAULTS.secondary));
  root.style.setProperty('--color-accent', withHash(colors.accent_color, DEFAULTS.accent));
}

export function resetTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty('--color-primary');
  root.style.removeProperty('--color-secondary');
  root.style.removeProperty('--color-accent');
}

export function stripHash(color: string): string {
  return color.replace(/^#/, '');
}
