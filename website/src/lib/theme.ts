/*
 * Light / dark theme. The page follows the visitor's system setting until they pick one with
 * the header toggle; their pick is remembered. The diskMon app windows stay dark in both themes
 * because the real app is dark (see .dm-window in styles.css).
 */

export type Theme = 'light' | 'dark';
const KEY = 'diskmon-theme';

/** Inlined into <head> so the theme is set before first paint and the page never flashes. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){}})()`;

export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* private mode: the choice just isn't remembered */ }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset['theme'] = theme;
}
