import { lazy, ComponentType } from 'react';

const RETRY_FLAG = 'lazy-chunk-retry';

/**
 * A drop-in replacement for React.lazy() that adds a single auto-retry on
 * chunk-load failures (stale Vite HMR cache, network hiccup, etc.).
 *
 * On failure:
 *  1. Logs the error to the console.
 *  2. If the page has NOT already been reloaded for this session, sets a
 *     sessionStorage flag and forces a full reload so Vite can refetch the
 *     latest chunk manifest.
 *  3. If a reload already happened (flag is set), re-throws the error so the
 *     nearest <ErrorBoundary> can render a graceful fallback instead of
 *     entering an infinite loop.
 *
 * Usage — identical to React.lazy():
 *   const SupervisorDashboard = lazyWithRetry(
 *     () => import('./pages/supervisor/SupervisorDashboard')
 *   );
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      // Clear the retry flag on success so future navigations can retry again.
      const result = await importFn();
      sessionStorage.removeItem(RETRY_FLAG);
      return result;
    } catch (error) {
      console.error('[lazyWithRetry] Dynamic import failed:', error);

      const hasRetried = sessionStorage.getItem(RETRY_FLAG);

      if (!hasRetried) {
        console.warn('[lazyWithRetry] First failure — reloading page to bust stale chunk cache.');
        sessionStorage.setItem(RETRY_FLAG, 'true');
        window.location.reload();
        // Return a never-resolving promise; the reload will take over.
        return new Promise<never>(() => {});
      }

      // Second failure after reload → propagate to ErrorBoundary.
      console.error('[lazyWithRetry] Reload did not fix the issue. Rendering error fallback.');
      throw error;
    }
  });
}
