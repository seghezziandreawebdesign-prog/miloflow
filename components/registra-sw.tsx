"use client";

import { useEffect } from "react";

/** Registra il service worker della PWA (solo in produzione). */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Senza service worker l'app funziona comunque, solo senza offline.
    });
  }, []);
  return null;
}
