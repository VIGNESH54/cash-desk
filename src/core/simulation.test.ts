import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, weekday } from './dates';
import { planDay, toLog } from './planner';
import type { Customer, Invoice, Snapshot, UdyamStatus } from './types';

// Deterministic PRNG so failures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = '2026-06-01';
const DAYS = 150;

function world(seed: number): Snapshot {
  const r = rng(seed);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const udyam = pick<UdyamStatus>(['registered_micro', 'registered_small', 'not_registered', 'unknown']);
  const customers: Customer[] = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    name: `Customer ${i}`,
    phone: r() < 0.85 ? `98${String(10000000 + Math.floor(r() * 89999999))}` : undefined,
    accountsPhone: r() < 0.3 ? `97${String(10000000 + Math.floor(r() * 89999999))}` : undefined,
    kind: r() < 0.8 ? 'business' : 'walk_in',
    tone: pick(['friendly', 'formal'] as const),
    applyLegal: r() < 0.6,
    language: pick(['en', 'hinglish'] as const),
    optedOut: r() < 0.15
  }));
  const invoices: Invoice[] = [];
  for (let i = 0; i < 24; i++) {
    invoices.push({
      id: `i${i}`,
      customerId: pick(customers).id,
      number: `N${i}`,
      issueDate: addDays(START, Math.floor(r() * 90) - 60),
      agreedDays: pick([0, 15, 30, 45, 60]),
      writtenAgreement: r() < 0.5,
      amount: 1000 + Math.floor(r() * 400000)
    });
  }
  return {
    business: { id: 'b', name: 'Sim Co', udyamStatus: udyam, bankRate: 5.75, briefHour: 21 },
    customers,
    invoices,
    payments: [],
    promises: [],
    reminders: [],
    events: []
  };
}

describe('150-day simulation, 40 random businesses', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}: safety rules hold every day`, () => {
      const snap = world(seed);
      const r = rng(seed * 7919);
      const registered = snap.business.udyamStatus.startsWith('registered');
      const sentOn = new Map<string, string[]>(); // customer -> sent dates
      const sentPerInvoice = new Map<string, number>();
      let promiseN = 0;

      for (let d = 0; d < DAYS; d++) {
        const today = addDays(START, d);
        const q = planDay(snap, today);
        const q2 = planDay(snap, today);
        expect(q.map((x) => x.key)).toEqual(q2.map((x) => x.key)); // deterministic

        if (weekday(today) === 0) expect(q).toEqual([]); // Sundays are quiet

        const seen = new Set<string>();
        for (const item of q) {
          expect(seen.has(item.customer.id)).toBe(false); // one per customer per day
          seen.add(item.customer.id);
          expect(item.customer.optedOut).toBe(false);
          expect(item.totalBalance).toBeGreaterThan(0);
          expect(item.body.length).toBeGreaterThan(20);
          const legalWords = /MSMED|43B|Section 16/i.test(item.body);
          if (legalWords) {
            expect(registered).toBe(true);
            expect(item.customer.kind).toBe('business');
            expect(item.customer.applyLegal).toBe(true);
          }
          for (const v of item.views) expect(v.balance).toBeGreaterThan(0);
        }

        // owner behaviour: sends most, skips some
        for (const item of q) {
          const skip = r() < 0.15;
          snap.reminders.push({
            ...toLog(item, skip ? 'skipped' : 'sent', 'whatsapp', item.body, `${today}T05:00:00Z`),
            id: `r${snap.reminders.length}`
          });
          if (!skip) {
            const list = sentOn.get(item.customer.id) ?? [];
            list.push(today);
            sentOn.set(item.customer.id, list);
            for (const id of Object.keys(item.firing)) sentPerInvoice.set(id, (sentPerInvoice.get(id) ?? 0) + 1);
          }
        }
        // idempotent once handled
        expect(planDay(snap, today)).toEqual([]);

        // world moves: some payments, some promises
        for (const inv of snap.invoices) {
          if (r() < 0.01) {
            const paid = snap.payments.filter((p) => p.invoiceId === inv.id).reduce((a, p) => a + p.amount, 0);
            const left = Math.round((inv.amount - paid) * 100) / 100;
            if (left > 0) {
              const amount = r() < 0.5 ? left : Math.max(1, Math.round(left / 2));
              snap.payments.push({ id: `p${snap.payments.length}`, invoiceId: inv.id, amount, paidOn: today });
            }
          }
          if (r() < 0.01 && !snap.promises.some((p) => p.invoiceId === inv.id && p.status === 'open')) {
            snap.promises.push({
              id: `pr${promiseN++}`,
              invoiceId: inv.id,
              promisedOn: addDays(today, 1 + Math.floor(r() * 10)),
              status: 'open'
            });
          }
        }
      }

      for (const dates of sentOn.values()) {
        for (let i = 1; i < dates.length; i++) expect(daysBetween(dates[i - 1]!, dates[i]!)).toBeGreaterThanOrEqual(1);
      }
      // a single invoice should never be chased more than ~once every 3 days on average over 150 days
      for (const n of sentPerInvoice.values()) expect(n).toBeLessThanOrEqual(30);
    });
  }
});
