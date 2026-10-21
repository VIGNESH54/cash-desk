import type { SupabaseClient } from '@supabase/supabase-js';

export const APP_VERSION = '0.1.0';
const MAX_PER_SESSION = 10;

let db: SupabaseClient | null = null;
let businessId: string | null = null;
const seen = new Set<string>();

/** Cloud mode turns reporting on. In demo mode errors only go to the console. */
export function configureMonitor(client: SupabaseClient | null, business: string | null) {
  db = client;
  businessId = business;
}

export const clip = (s: string | undefined, n: number): string | null => (s ? s.slice(0, n) : null);

export function toReport(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error)
    return { message: clip(err.message || err.name, 500) ?? 'Error', stack: clip(err.stack, 4000) };
  if (typeof err === 'string') return { message: clip(err, 500) ?? 'Error', stack: null };
  try {
    return { message: clip(JSON.stringify(err), 500) ?? 'Unknown error', stack: null };
  } catch {
    return { message: 'Unknown error', stack: null };
  }
}

/** Never throws, never blocks the UI. Identical messages are reported once per page load. */
export function reportError(err: unknown, where?: string): void {
  const r = toReport(err);
  console.error(where ? `[${where}]` : '[error]', err);
  if (!db || seen.size >= MAX_PER_SESSION || seen.has(r.message)) return;
  seen.add(r.message);
  void Promise.resolve(
    db.from('client_errors').insert({
      business_id: businessId,
      message: where ? clip(`${where}: ${r.message}`, 500) : r.message,
      stack: r.stack,
      url: clip(window.location.href.split('?')[0], 500),
      user_agent: clip(navigator.userAgent, 300),
      app_version: APP_VERSION
    })
  ).catch(() => undefined);
}

export function installGlobalHandlers(): () => void {
  const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, 'window.onerror');
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, 'unhandledrejection');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
