import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, storeTheme, storedTheme, type Theme } from '@/lib/theme';

/** Header button that flips between light and dark. Both icons render; CSS shows the right one. */
export function ThemeToggle() {
  // Until the visitor picks a theme, keep following the system setting as it changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => { if (!storedTheme()) applyTheme(mq.matches ? 'light' : 'dark'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = document.documentElement.dataset['theme'] === 'light' ? 'dark' : 'light';
    storeTheme(next);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // A cross-fade where the browser supports view transitions; an instant switch elsewhere.
    if (!reduced && 'startViewTransition' in document) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  };

  return <button type="button" className="theme-toggle" onClick={toggle} aria-label="Switch between light and dark theme" title="Switch theme">
    <Sun className="theme-icon-sun" aria-hidden="true" />
    <Moon className="theme-icon-moon" aria-hidden="true" />
  </button>;
}
