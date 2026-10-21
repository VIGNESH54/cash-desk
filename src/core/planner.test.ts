import { describe, expect, it } from 'vitest';
import { buildBrief } from './brief';
import { addDays } from './dates';
import { buildViews, summariseByCustomer, totals } from './ledger';
import { attention, planDay, toLog } from './planner';
import { seedSnapshot } from './seed';
import { buildStatement } from './statement';
import type { Snapshot } from './types';

const TODAY = '2026-10-20'; // a Tuesday
const seed = (): Snapshot => seedSnapshot(TODAY);
const byCustomer = (snap: Snapshot, day = TODAY) => new Map(planDay(snap, day).map((q) => [q.customer.id, q]));

describe('ledger', () => {
  const views = buildViews(seed(), TODAY);
  const find = (id: string) => views.find((v) => v.invoice.id === id)!;

  it('computes balance, days overdue and bucket', () => {
    const v = find('i-2150');
    expect(v.paid).toBe(60000);
    expect(v.balance).toBe(200000);
    expect(v.daysOverdue).toBe(45);
    expect(v.bucket).toBe('31-60');
    expect(v.legalOn).toBe(true);
    expect(v.daysToLegal).toBe(-45);
    expect(v.interest).toBeGreaterThan(4000);
    expect(v.interest).toBeLessThan(4700);
  });
  it('knows an invoice is about to hit the legal limit', () => {
    const v = find('i-2207');
    expect(v.daysOverdue).toBe(-4);
    expect(v.daysToLegal).toBe(4);
    expect(v.interest).toBe(0);
  });
  it('treats paid invoices as paid', () => {
    expect(find('i-2190').stage).toBe('paid');
    expect(find('i-2190').balance).toBe(0);
  });
  it('adds up totals', () => {
    const t = totals(views);
    // 480000 + 95000 + 200000 + 115000 + 40000 + 32000 + 68000 + 210000
    expect(t.outstanding).toBe(1240000);
    expect(t.invoicesOpen).toBe(8);
    expect(t.byBucket.current).toBe(480000 + 95000 + 40000);
    expect(t.pastLegalCount).toBeGreaterThanOrEqual(2);
    expect(t.interestOnPaper).toBeGreaterThan(0);
    const bucketSum = Object.values(t.byBucket).reduce((a, b) => a + b, 0);
    expect(bucketSum).toBe(t.outstanding);
  });
  it('ranks customers by what is overdue', () => {
    const s = seed();
    const sum = summariseByCustomer(views, s.customers);
    expect(sum[0].customer.id).toBe('c-gupta');
  });
});

describe('planner: who gets what today', () => {
  const q = byCustomer(seed());

  it('sends exactly the customers that need contact', () => {
    expect([...q.keys()].sort()).toEqual(['c-gupta', 'c-kumar', 'c-patel', 'c-sharma', 'c-singh']);
  });
  it('warns the big buyer before day 45, not after', () => {
    const s = q.get('c-sharma')!;
    expect(s.step).toBe('legal_heads_up');
    expect(s.level).toBe('legal');
    expect(s.to).toBe('+919876543102'); // accounts contact, not the main one
    expect(s.toKind).toBe('accounts');
    expect(s.body).toContain('Hello Accounts team at Sharma Auto Components');
    expect(s.body).toContain('45-day legal payment limit');
    expect(s.body).toContain('Section 43B(h)');
    expect(s.body).toContain('in 4 days');
    expect(s.body).toContain('Reply STOP');
  });
  it('sends the interest statement once the limit has long passed', () => {
    const p = q.get('c-patel')!;
    expect(p.step).toBe('interest_2');
    expect(p.body).toContain('Section 16');
    expect(p.body).toContain('₹2,00,000');
    expect(p.body).toContain('statement of dues is attached');
  });
  it('talks to a small walk-in customer softly, in their language, with no legal wording', () => {
    const k = q.get('c-kumar')!;
    expect(k.step).toBe('nudge');
    expect(k.body).toContain('Namaste Kumar ji');
    expect(k.body).toContain('9 din se pending');
    expect(k.body).not.toMatch(/MSMED|43B|legal/i);
  });
  it('keeps following up a silent customer on the weekly rung', () => {
    expect(q.get('c-gupta')!.step).toBe('weekly_3');
  });
  it('starts a long-overdue, never-contacted invoice at "firm", not at the harshest rung', () => {
    const sg = q.get('c-singh')!;
    expect(sg.step).toBe('firm');
    expect(sg.phoneValid).toBe(false);
    expect(sg.whatsappUrl).toBe('');
  });
  it('leaves a customer with a pending promise alone', () => {
    expect(q.has('c-lakshmi')).toBe(false);
  });
  it('does not chase paid invoices', () => {
    expect(q.has('c-mehta')).toBe(false);
  });
  it('builds a ready-to-open WhatsApp link', () => {
    const k = q.get('c-kumar')!;
    expect(k.whatsappUrl.startsWith('https://wa.me/919876543131?text=')).toBe(true);
    expect(decodeURIComponent(k.whatsappUrl.split('text=')[1])).toBe(k.body);
  });
  it('orders the queue by seriousness', () => {
    const order = planDay(seed(), TODAY).map((i) => i.customer.id);
    expect(order[0]).toBe('c-patel');
    expect(order[1]).toBe('c-sharma');
  });
});

describe('planner: rules that protect the relationship', () => {
  it('never sends on a Sunday', () => {
    expect(planDay(seed(), '2026-10-25')).toEqual([]);
    expect(planDay(seed(), '2026-10-25', { skipSundays: false }).length).toBeGreaterThan(0);
  });
  it('does not repeat itself: once sent, nothing more goes the same day', () => {
    const snap = seed();
    const first = planDay(snap, TODAY);
    for (const item of first)
      snap.reminders.push({
        id: `n-${item.key}`,
        ...toLog(item, 'sent', 'whatsapp', item.body, `${TODAY}T05:00:00.000Z`)
      });
    expect(planDay(snap, TODAY)).toEqual([]);
  });
  it('does not repeat itself the next day either, only the next step later', () => {
    const snap = seed();
    for (const item of planDay(snap, TODAY))
      snap.reminders.push({
        id: `n-${item.key}`,
        ...toLog(item, 'sent', 'whatsapp', item.body, `${TODAY}T05:00:00.000Z`)
      });
    expect(planDay(snap, addDays(TODAY, 1))).toEqual([]);
    expect(planDay(snap, addDays(TODAY, 2))).toEqual([]);
  });
  it('treats a skipped message as handled, so it is not nagged again', () => {
    const snap = seed();
    const k = planDay(snap, TODAY).find((i) => i.customer.id === 'c-kumar')!;
    snap.reminders.push({ id: 'skip', ...toLog(k, 'skipped', 'manual', k.body, `${TODAY}T05:00:00.000Z`) });
    expect(byCustomer(snap).has('c-kumar')).toBe(false);
  });
  it('respects an opt-out', () => {
    const snap = seed();
    snap.customers.find((c) => c.id === 'c-kumar')!.optedOut = true;
    expect(byCustomer(snap).has('c-kumar')).toBe(false);
    expect(attention(snap, TODAY).some((a) => a.customerId === 'c-kumar' && a.kind === 'opted_out')).toBe(true);
  });
  it('stops the moment an invoice is paid', () => {
    const snap = seed();
    snap.payments.push({ id: 'pay', invoiceId: 'i-2189', amount: 32000, paidOn: TODAY });
    expect(byCustomer(snap).has('c-kumar')).toBe(false);
  });
  it('combines several overdue invoices of one customer into one message', () => {
    const snap = seed();
    snap.invoices.push({
      id: 'i-extra',
      customerId: 'c-kumar',
      number: 'INV-2195',
      issueDate: addDays(TODAY, -22),
      agreedDays: 15,
      writtenAgreement: true,
      amount: 8000
    });
    const items = planDay(snap, TODAY).filter((i) => i.customer.id === 'c-kumar');
    expect(items).toHaveLength(1);
    expect(items[0].views).toHaveLength(2);
    expect(items[0].body).toContain('Neeche likhe invoices');
    expect(items[0].body).toContain('Total: ₹40,000');
  });
});

describe('planner: promises', () => {
  it('checks in on the day a customer promised to pay', () => {
    const q = byCustomer(seed(), '2026-10-23');
    expect(q.get('c-lakshmi')!.step.startsWith('promise_check:')).toBe(true);
    expect(q.get('c-lakshmi')!.body).toContain('You mentioned payment today');
  });
  it('follows up the day after a promise is missed, and names the date', () => {
    const q = byCustomer(seed(), '2026-10-24');
    const l = q.get('c-lakshmi')!;
    expect(l.step.startsWith('promise_broken:')).toBe(true);
    expect(l.promiseId).toBe('pr1');
    expect(l.body).toContain('23 Oct 2026');
  });
  it('is silent in between', () => {
    expect(byCustomer(seed(), '2026-10-21').has('c-lakshmi')).toBe(false);
    expect(byCustomer(seed(), '2026-10-22').has('c-lakshmi')).toBe(false);
  });
});

describe('attention list', () => {
  const a = attention(seed(), TODAY);
  it('flags a customer who ignores repeated reminders', () => {
    expect(a.find((x) => x.customerId === 'c-gupta')?.kind).toBe('needs_call');
  });
  it('flags a customer with no phone number', () => {
    expect(a.find((x) => x.customerId === 'c-singh')?.kind).toBe('no_phone');
  });
  it('does not flag a customer who has a pending promise', () => {
    expect(a.find((x) => x.customerId === 'c-lakshmi')).toBeUndefined();
  });
});

describe('nightly brief', () => {
  const b = buildBrief(seed(), TODAY);
  it('summarises cash in and cash owed', () => {
    expect(b.receivedToday).toBe(52000);
    expect(b.receivedCount).toBe(1);
    expect(b.outstanding).toBe(1240000);
    expect(b.text).toContain('*Cash brief, Tue 20 Oct*');
    expect(b.text).toContain('₹52,000 in 1 payment');
    expect(b.text).toContain('₹12,40,000 in total');
  });
  it('lists what is about to cross the legal limit and who needs a call', () => {
    expect(b.crossingSoon.map((v) => v.invoice.number)).toEqual(['INV-2207']);
    expect(b.text).toContain('Sharma Auto Components');
    expect(b.text).toContain('in 4 days');
    expect(b.text).toContain('*Needs a call from you*');
    expect(b.text).toContain('Gupta Enterprises');
  });
  it('says how much is ready tomorrow', () => {
    expect(b.queueTomorrow).toBeGreaterThanOrEqual(0);
    expect(b.text).toMatch(/Tomorrow: /);
  });
});

describe('statement of dues', () => {
  it('adds principal and interest per invoice', () => {
    const snap = seed();
    const views = buildViews(snap, TODAY);
    const customer = snap.customers.find((c) => c.id === 'c-patel')!;
    const st = buildStatement(snap.business, customer, views, TODAY);
    expect(st.rows).toHaveLength(1);
    expect(st.principal).toBe(200000);
    expect(st.interest).toBe(st.rows[0].interest);
    expect(st.total).toBe(st.principal + st.interest);
    expect(st.annualRatePct).toBeCloseTo(17.25, 5);
    expect(st.notes.join(' ')).toMatch(/accountant/);
  });
});
