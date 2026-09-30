import { useEffect, useState } from 'react';

/** Ctrl+K / Cmd+K, insensível a Caps Lock e a Shift. */
export function isSearchShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k';
}

/** Rótulo da tecla modificadora conforme a plataforma ('⌘' no Mac, 'Ctrl' nos demais). */
export function useModifierLabel(): string {
  const [label, setLabel] = useState('Ctrl');
  useEffect(() => {
    if (navigator.platform.toUpperCase().includes('MAC')) setLabel('⌘');
  }, []);
  return label;
}
