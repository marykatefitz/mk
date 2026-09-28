import { create } from 'zustand';

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  theme: 'system' | 'light' | 'dark';
  motion: 'system' | 'reduced' | 'full';
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  relaxedTimers: boolean;
  readableDialogue: boolean;
}

const DEFAULTS: Settings = {
  music: 0.5,
  sfx: 0.7,
  muted: false,
  theme: 'system',
  motion: 'system',
  textSpeed: 'normal',
  relaxedTimers: false,
  readableDialogue: false,
};

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('dq.settings') ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<Settings & { set(p: Partial<Settings>): void }>((set, get) => ({
  ...load(),
  set(p) {
    set(p);
    const { set: _omit, ...rest } = { ...get(), ...p };
    void _omit;
    try {
      localStorage.setItem('dq.settings', JSON.stringify(rest));
    } catch {
      /* ignore */
    }
    applySettingsToDocument();
  },
}));

export function applySettingsToDocument() {
  const s = useSettings.getState();
  const root = document.documentElement;
  if (s.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  if (s.motion === 'system') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', s.motion);
}

export function prefersReducedMotion(): boolean {
  const m = useSettings.getState().motion;
  if (m === 'reduced') return true;
  if (m === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
