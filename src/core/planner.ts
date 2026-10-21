import { daysBetween, weekday, type IsoDate } from './dates';
import { buildViews, type InvoiceView } from './ledger';
import { normalizePhone, smsLink, whatsappLink } from './phone';
import { composeMessage, stepBase, stepLabel, stepLevel, type Level } from './templates';
import type { Customer, ReminderLog, Snapshot } from './types';

export interface PlannerOptions {
  /** Many small businesses are shut on Sundays. Default true. */
  skipSundays?: boolean;
  includeOptOut?: boolean;
}

export interface QueueItem {
  key: string;
  plannedFor: IsoDate;
  customer: Customer;
  /** every invoice listed in the message */
  views: InvoiceView[];
  /** the step that applies to each listed invoice */
  firing: Record<string, string>;
  step: string;
  level: Level;
  label: string;
  body: string;
  to: string;
  toKind: 'main' | 'accounts';
  phoneValid: boolean;
  whatsappUrl: string;
  smsUrl: string;
  promiseId?: string;
  totalBalance: number;
  priority: number;
}

export interface Rung {
  id: string;
  /** days after the agreed due date */
  at: number;
}

/** The ordinary reminder ladder. Formal business customers also get a note to their accounts team. */
export function cadence(c: Customer): Rung[] {
  if (c.tone === 'friendly' || c.kind === 'walk_in') {
    return [
      { id: 'due', at: 0 },
      { id: 'nudge', at: 4 },
      { id: 'firm', at: 10 },
      { id: 'weekly_1', at: 20 },
      { id: 'weekly_2', at: 30 },
      { id: 'weekly_3', at: 40 },
      { id: 'weekly_4', at: 50 }
    ];
  }
  return [
    { id: 'due', at: 0 },
    { id: 'nudge', at: 3 },
    { id: 'accounts', at: 7 },
    { id: 'firm', at: 14 },
    { id: 'weekly_1', at: 21 },
    { id: 'weekly_2', at: 28 },
    { id: 'weekly_3', at: 35 },
    { id: 'weekly_4', at: 42 },
    { id: 'weekly_5', at: 49 },
    { id: 'weekly_6', at: 56 }
  ];
}

export function priority(step: string): number {
  const b = stepBase(step);
  if (b === 'promise_broken') return 90;
  if (b.startsWith('interest_')) return 85;
  if (b === 'legal_passed') return 80;
  if (b === 'legal_heads_up') return 75;
  if (b === 'promise_check') return 70;
  if (b.startsWith('weekly_')) return 55;
  if (b === 'firm') return 50;
  if (b === 'accounts') return 40;
  if (b === 'nudge') return 30;
  return 20;
}

/** Minimum days since the last message to this customer before this step may go out. */
export function minGap(step: string): number {
  const b = stepBase(step);
  if (b.startsWith('promise_')) return 0;
  if (b.startsWith('weekly_')) return 7;
  if (b.startsWith('interest_')) return 14;
  if (b.startsWith('legal_')) return 2;
  return 3;
}

function stepsDoneFor(s: Snapshot, invoiceId: string): Set<string> {
  const done = new Set<string>();
  for (const r of s.reminders) {
    if (!r.invoiceIds.includes(invoiceId)) continue;
    done.add(r.invoiceSteps[invoiceId] ?? r.step);
  }
  return done;
}

/** The cadence rung an invoice is on today. First contact never starts harsher than "firm". */
function ladderPick(v: InvoiceView, contactedBefore: boolean): Rung | undefined {
  if (v.daysOverdue < 0) return undefined;
  const ladder = cadence(v.customer);
  const eligible = ladder.filter((r) => r.at <= v.daysOverdue);
  if (!eligible.length) return undefined;
  let idx = eligible.length - 1;
  if (!contactedBefore) {
    const cap = ladder.findIndex((r) => r.id === 'firm');
    idx = Math.min(idx, cap);
  }
  return ladder[idx];
}

function candidatesFor(v: InvoiceView, done: Set<string>, today: IsoDate): string[] {
  if (v.stage === 'paid') return [];

  if (v.activePromise) {
    if (v.activePromise.promisedOn === today) {
      const id = `promise_check:${v.activePromise.id}`;
      return done.has(id) ? [] : [id];
    }
    return []; // a promise is pending: leave them alone until the date
  }
  if (v.brokenPromise) {
    const id = `promise_broken:${v.brokenPromise.id}`;
    if (!done.has(id)) return [id];
  }

  const out: string[] = [];
  const contacted = [...done].some((d) => !d.startsWith('promise_'));
  const pick = ladderPick(v, contacted);
  if (pick && !done.has(pick.id)) out.push(pick.id);

  if (v.legalOn) {
    if (v.daysToLegal >= 0 && v.daysToLegal <= 5 && !done.has('legal_heads_up')) out.push('legal_heads_up');
    if (v.daysToLegal < 0) {
      if (!done.has('legal_passed')) out.push('legal_passed');
      else if (v.daysToLegal <= -15) {
        const k = 1 + Math.floor((-v.daysToLegal - 15) / 30);
        const id = `interest_${k}`;
        if (!done.has(id)) out.push(id);
      }
    }
  }
  return out;
}

function lastSentDate(logs: ReminderLog[], customerId: string): IsoDate | undefined {
  let last: IsoDate | undefined;
  for (const r of logs) {
    if (r.customerId !== customerId || r.status !== 'sent') continue;
    // plannedFor is the owner's local (IST) day; sentAt is UTC and can fall on the previous date
    const d = r.plannedFor;
    if (!last || d > last) last = d;
  }
  return last;
}

/**
 * Today's messages. Derived from the invoices and the history of what was already sent or skipped,
 * so it can be recomputed at any time without duplicating anything.
 *
 * Rules:
 * - one message per customer per day, listing every overdue invoice they owe
 * - never contact a customer with a pending promise until the promised date
 * - legal wording only where it applies and only to the accounts contact
 * - weekly steps wait at least 7 days after the last message, other steps 3
 * - an old invoice imported late starts at "firm" at most
 */
export function planDay(s: Snapshot, today: IsoDate, opts: PlannerOptions = {}): QueueItem[] {
  if (opts.skipSundays !== false && weekday(today) === 0) return [];
  const views = buildViews(s, today);
  const byCustomer = new Map<string, InvoiceView[]>();
  for (const v of views) {
    const list = byCustomer.get(v.customer.id) ?? [];
    list.push(v);
    byCustomer.set(v.customer.id, list);
  }

  const items: QueueItem[] = [];
  for (const [, vs] of byCustomer) {
    const customer = vs[0].customer;
    if (customer.optedOut) continue;
    // Sent or skipped today means this customer is handled for today. Skipping must not surface the next rung at once.
    if (s.reminders.some((r) => r.customerId === customer.id && r.plannedFor === today)) continue;

    const last = lastSentDate(s.reminders, customer.id);
    const gap = last ? daysBetween(last, today) : Number.POSITIVE_INFINITY;

    const chosen = new Map<string, string>(); // invoiceId -> its best allowed step
    for (const v of vs) {
      const done = stepsDoneFor(s, v.invoice.id);
      const allowed = candidatesFor(v, done, today)
        .filter((st) => gap >= minGap(st))
        .sort((a, b) => priority(b) - priority(a));
      if (allowed.length) chosen.set(v.invoice.id, allowed[0]);
    }
    if (!chosen.size) continue;

    const head = [...chosen.values()].sort((a, b) => priority(b) - priority(a))[0];
    const listed = vs.filter((v) => chosen.has(v.invoice.id) || (v.stage === 'overdue' && !v.activePromise));

    const firing: Record<string, string> = {};
    for (const v of listed) {
      const own = chosen.get(v.invoice.id);
      if (own) {
        firing[v.invoice.id] = own;
      } else {
        const done = stepsDoneFor(s, v.invoice.id);
        const contacted = [...done].some((d) => !d.startsWith('promise_'));
        firing[v.invoice.id] = ladderPick(v, contacted)?.id ?? head;
      }
    }

    const level = stepLevel(head);
    const toAccounts = level === 'legal' || stepBase(head) === 'accounts';
    const to = toAccounts
      ? customer.accountsPhone || customer.phone || ''
      : customer.phone || customer.accountsPhone || '';
    const toKind: 'main' | 'accounts' = toAccounts && customer.accountsPhone ? 'accounts' : 'main';
    const phone = normalizePhone(to);

    const headView = listed.find((v) => chosen.get(v.invoice.id) === head);
    const promiseId = head.startsWith('promise_') ? head.split(':')[1] : undefined;
    const promiseOn = headView?.activePromise?.promisedOn ?? headView?.brokenPromise?.promisedOn;

    const body = composeMessage({
      business: s.business,
      customer,
      views: listed,
      step: head,
      today,
      promiseOn,
      includeOptOut: opts.includeOptOut
    });

    items.push({
      key: `${customer.id}:${today}`,
      plannedFor: today,
      customer,
      views: listed,
      firing,
      step: head,
      level,
      label: stepLabel(head),
      body,
      to: phone.valid ? phone.e164 : to,
      toKind,
      phoneValid: phone.valid,
      whatsappUrl: phone.valid ? whatsappLink(to, body) : '',
      smsUrl: phone.valid ? smsLink(to, body) : '',
      promiseId,
      totalBalance: listed.reduce((a, v) => a + v.balance, 0),
      priority: priority(head)
    });
  }
  return items.sort((a, b) => b.priority - a.priority || b.totalBalance - a.totalBalance);
}

/** Builds the history row to store once the owner sends or skips a queued message. */
export function toLog(
  item: QueueItem,
  status: 'sent' | 'skipped',
  channel: ReminderLog['channel'],
  body: string,
  nowIso: string
): Omit<ReminderLog, 'id'> {
  return {
    customerId: item.customer.id,
    invoiceIds: Object.keys(item.firing),
    step: item.step,
    invoiceSteps: item.firing,
    channel,
    plannedFor: item.plannedFor,
    body,
    status,
    sentAt: nowIso
  };
}

export interface Attention {
  customerId: string;
  customerName: string;
  kind: 'no_phone' | 'needs_call' | 'opted_out';
  detail: string;
  amount: number;
}

/** Customers that software cannot fix: missing numbers, silence after repeated reminders, opt-outs. */
export function attention(s: Snapshot, today: IsoDate): Attention[] {
  const views = buildViews(s, today);
  const out: Attention[] = [];
  const cutoff = new Date(Date.parse(today + 'T00:00:00Z') - 30 * 86_400_000).toISOString().slice(0, 10);

  for (const c of s.customers) {
    const mine = views.filter((v) => v.customer.id === c.id && v.stage === 'overdue');
    if (!mine.length) continue;
    const amount = mine.reduce((a, v) => a + v.balance, 0);
    const worst = Math.max(...mine.map((v) => v.daysOverdue));

    if (c.optedOut) {
      out.push({
        customerId: c.id,
        customerName: c.name,
        kind: 'opted_out',
        detail: 'Asked to stop reminders. Call or visit.',
        amount
      });
      continue;
    }
    if (!normalizePhone(c.phone).valid && !normalizePhone(c.accountsPhone).valid) {
      out.push({
        customerId: c.id,
        customerName: c.name,
        kind: 'no_phone',
        detail: 'No valid phone number on file.',
        amount
      });
      continue;
    }
    const sent = s.reminders.filter(
      (r) => r.customerId === c.id && r.status === 'sent' && r.plannedFor >= cutoff
    ).length;
    const replied = s.events.some((e) => e.customerId === c.id && e.kind === 'reply' && e.at.slice(0, 10) >= cutoff);
    const hasPromise = mine.some((v) => v.activePromise);
    if (sent >= 3 && !replied && worst >= 14 && !hasPromise) {
      out.push({
        customerId: c.id,
        customerName: c.name,
        kind: 'needs_call',
        detail: `${sent} reminders, no reply. A call will work better.`,
        amount
      });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}
