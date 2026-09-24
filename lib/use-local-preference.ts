"use client";

import { useCallback, useSyncExternalStore } from "react";

// Preferenza del singolo browser (es. vista tabella/card). Se lo storage non è
// disponibile si usa il valore di default, senza errori.

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  }, []);

  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage non disponibile: la preferenza vale solo finché la pagina resta aperta
      }
      for (const notify of listeners) notify();
    },
    [key],
  );

  return [value, setValue];
}
