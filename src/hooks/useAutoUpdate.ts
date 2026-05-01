/// <reference types="vite/client" />
import { useEffect } from 'react';

/**
 * useAutoUpdate — Auto-detects new deployments on Cloudflare and triggers a
 * hard refresh so users always run the latest build.
 *
 * How it works:
 *  1. On initial load (production only), fetch `/index.html` with cache-busting.
 *  2. Extract the Vite asset hash from the `<script>` tag
 *     (e.g. `/assets/index-Bc3xK9f2.js`).
 *  3. Compare with the hash present in the *currently running* document.
 *  4. If they differ → a new build is live → reload.
 *
 * Loop-prevention:
 *  - A sessionStorage flag records the timestamp of the last auto-reload.
 *  - If the flag is younger than COOLDOWN_MS we skip, preventing infinite loops.
 */

const SS_LAST_AUTO_RELOAD = 'auto_update_last_reload';
const COOLDOWN_MS = 30_000; // 30 seconds – plenty to survive one reload cycle

/** Regex that matches Vite's default entry chunk naming: /assets/index-HASH.js */
const VITE_ENTRY_RE = /\/assets\/index-([a-zA-Z0-9_-]+)\.js/;

function extractBuildHash(html: string): string | null {
  const match = html.match(VITE_ENTRY_RE);
  return match ? match[1] : null;
}

export function useAutoUpdate(): void {
  useEffect(() => {
    // Only run in production builds deployed on Cloudflare
    if (!import.meta.env.PROD) return;

    // --- Loop guard ---------------------------------------------------
    const lastReload = Number(sessionStorage.getItem(SS_LAST_AUTO_RELOAD) || '0');
    if (Date.now() - lastReload < COOLDOWN_MS) {
      // We already reloaded very recently – skip to avoid infinite loop
      return;
    }

    // --- Extract the hash that is *currently* running -----------------
    const currentHash = extractBuildHash(document.documentElement.innerHTML);

    // --- Fetch the latest index.html from the server ------------------
    const controller = new AbortController();

    fetch(`/index.html?_cb=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((serverHtml) => {
        const serverHash = extractBuildHash(serverHtml);

        if (!serverHash || !currentHash) {
          // Can't compare – silently bail
          return;
        }

        if (serverHash !== currentHash) {
          // New build detected → record timestamp & hard-reload
          sessionStorage.setItem(SS_LAST_AUTO_RELOAD, String(Date.now()));
          window.location.reload();
        }
      })
      .catch(() => {
        // Network error, offline, etc. – silently ignore
      });

    return () => controller.abort();
  }, []); // Run once on mount
}
