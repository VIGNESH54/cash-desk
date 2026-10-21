import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, todayISO, type IsoDate } from '../core/dates';
import { buildViews, type InvoiceView } from '../core/ledger';
import { planDay, toLog, type QueueItem } from '../core/planner';
import type { Customer, Invoice, Snapshot } from '../core/types';
import { DemoRepo } from '../data/demoRepo';
import type { Repo } from '../data/repo';

const OFFSET_KEY = 'cashdesk.demo.offset';

interface Ctx {
  repo: Repo;
  snap: Snapshot;
  today: IsoDate;
  views: InvoiceView[];
  queue: QueueItem[];
  busy: boolean;
  error: string | null;
  clearError(): void;
  /** demo only */
  dayOffset: number;
  setDayOffset(n: number): void;
  resetDemo(): void;
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  markSent(item: QueueItem, body: string, channel: 'whatsapp' | 'sms' | 'manual'): Promise<void>;
  skip(item: QueueItem): Promise<void>;
  addPayment(invoiceId: string, amount: number, paidOn: IsoDate, method?: string): Promise<void>;
  addPromise(invoiceId: string, promisedOn: IsoDate, note?: string): Promise<void>;
  addEvent(customerId: string, kind: 'reply' | 'call' | 'note', body: string, invoiceId?: string): Promise<void>;
  saveCustomer(id: string, patch: Partial<Omit<Customer, 'id'>>): Promise<void>;
  addInvoice(inv: Omit<Invoice, 'id'>): Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useApp = (): Ctx => {
  const v = useContext(C);
  if (!v) throw new Error('useApp outside provider');
  return v;
};

function readOffset(): number {
  try {
    return Number(localStorage.getItem(OFFSET_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function Provider({ initial, children }: { initial: Repo; children: ReactNode }) {
  const [repo, setRepo] = useState<Repo>(initial);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayOffset, setOffset] = useState(repo.mode === 'demo' ? readOffset() : 0);

  const realToday = todayISO();
  const today = addDays(realToday, dayOffset);

  const reload = useCallback(async (r: Repo) => {
    setSnap(await r.load());
  }, []);

  useEffect(() => {
    let live = true;
    r_load(repo)
      .then((s) => live && setSnap(s))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [repo]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      setBusy(true);
      setError(null);
      try {
        const out = await fn();
        await reload(repo);
        return out;
      } catch (e) {
        setError((e as Error).message);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [repo, reload]
  );

  const views = useMemo(() => (snap ? buildViews(snap, today) : []), [snap, today]);
  const queue = useMemo(() => (snap ? planDay(snap, today) : []), [snap, today]);

  if (!snap) {
    return <div className="boot">{error ? <p className="err">{error}</p> : <p>Loading ledger…</p>}</div>;
  }

  const nowIso = () => new Date().toISOString();
  const ctx: Ctx = {
    repo,
    snap,
    today,
    views,
    queue,
    busy,
    error,
    clearError: () => setError(null),
    dayOffset,
    setDayOffset: (n) => {
      setOffset(n);
      try {
        localStorage.setItem(OFFSET_KEY, String(n));
      } catch {
        /* ignore */
      }
    },
    resetDemo: () => {
      setOffset(0);
      try {
        localStorage.removeItem(OFFSET_KEY);
      } catch {
        /* ignore */
      }
      setRepo(DemoRepo.reset(realToday));
    },
    run,
    markSent: async (item, body, channel) => {
      await run(() => repo.addReminder(toLog(item, 'sent', channel, body, nowIso())));
    },
    skip: async (item) => {
      await run(() => repo.addReminder(toLog(item, 'skipped', 'manual', '', nowIso())));
    },
    addPayment: async (invoiceId, amount, paidOn, method) => {
      await run(() => repo.addPayments([{ invoiceId, amount, paidOn, method }]));
    },
    addPromise: async (invoiceId, promisedOn, note) => {
      await run(() => repo.addPromise({ invoiceId, promisedOn, note }));
    },
    addEvent: async (customerId, kind, body, invoiceId) => {
      await run(() => repo.addEvent({ customerId, kind, body, invoiceId, at: nowIso() }));
    },
    saveCustomer: async (id, patch) => {
      await run(() => repo.updateCustomer(id, patch));
    },
    addInvoice: async (inv) => {
      await run(() => repo.addInvoices([inv]));
    }
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

const r_load = (r: Repo) => r.load();
