import { daysBetween, type IsoDate } from './dates';
import { agreedDueDate, acceptanceDate, legalApplies, legalDueDate, legalLimitDays, statutoryInterest } from './legal';
import { round2 } from './money';
import type { Customer, Invoice, PromiseRecord, Snapshot } from './types';

export type Bucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';
export type Stage = 'paid' | 'not_due' | 'due_today' | 'overdue';

export const BUCKETS: Bucket[] = ['current', '1-30', '31-60', '61-90', '90+'];

export interface InvoiceView {
  invoice: Invoice;
  customer: Customer;
  paid: number;
  balance: number;
  acceptedOn: IsoDate;
  agreedDue: IsoDate;
  legalDue: IsoDate;
  limitDays: number;
  /** vs the agreed due date; negative means days still left */
  daysOverdue: number;
  /** until the legal limit; negative means it has passed */
  daysToLegal: number;
  legalOn: boolean;
  stage: Stage;
  bucket: Bucket;
  /** statutory interest on paper to date; 0 unless legal wording applies and the limit passed */
  interest: number;
  /** promise made for a future date (or today) that is still open */
  activePromise?: PromiseRecord;
  /** promise whose date passed with the invoice still unpaid */
  brokenPromise?: PromiseRecord;
}

export function bucketFor(daysOverdue: number): Bucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

export function buildViews(s: Snapshot, today: IsoDate): InvoiceView[] {
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const paidBy = new Map<string, number>();
  for (const p of s.payments) paidBy.set(p.invoiceId, (paidBy.get(p.invoiceId) ?? 0) + p.amount);

  const views: InvoiceView[] = [];
  for (const invoice of s.invoices) {
    const customer = customers.get(invoice.customerId);
    if (!customer) continue;
    const paid = round2(paidBy.get(invoice.id) ?? 0);
    const balance = round2(invoice.amount - paid);
    const agreedDue = agreedDueDate(invoice);
    const legalDue = legalDueDate(invoice);
    const daysOverdue = daysBetween(agreedDue, today);
    const daysToLegal = daysBetween(today, legalDue);
    const legalOn = legalApplies(s.business, customer);
    const open = balance > 0.005;
    const stage: Stage = !open ? 'paid' : daysOverdue > 0 ? 'overdue' : daysOverdue === 0 ? 'due_today' : 'not_due';

    const promises = s.promises.filter((p) => p.invoiceId === invoice.id && p.status === 'open');
    const activePromise = open
      ? promises.filter((p) => p.promisedOn >= today).sort((a, b) => a.promisedOn.localeCompare(b.promisedOn))[0]
      : undefined;
    const brokenPromise = open
      ? promises.filter((p) => p.promisedOn < today).sort((a, b) => b.promisedOn.localeCompare(a.promisedOn))[0]
      : undefined;

    const interest =
      open && legalOn && daysToLegal < 0
        ? statutoryInterest(balance, legalDue, today, s.business.bankRate).interest
        : 0;

    views.push({
      invoice,
      customer,
      paid,
      balance: open ? balance : 0,
      acceptedOn: acceptanceDate(invoice),
      agreedDue,
      legalDue,
      limitDays: legalLimitDays(invoice),
      daysOverdue,
      daysToLegal,
      legalOn,
      stage,
      bucket: open ? bucketFor(daysOverdue) : 'current',
      interest,
      activePromise,
      brokenPromise
    });
  }
  return views;
}

export interface Totals {
  outstanding: number;
  overdue: number;
  invoicesOpen: number;
  invoicesOverdue: number;
  byBucket: Record<Bucket, number>;
  interestOnPaper: number;
  /** open invoices past the legal limit (legal wording on) */
  pastLegalCount: number;
  pastLegalAmount: number;
}

export function totals(views: InvoiceView[]): Totals {
  const byBucket: Record<Bucket, number> = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const t: Totals = {
    outstanding: 0,
    overdue: 0,
    invoicesOpen: 0,
    invoicesOverdue: 0,
    byBucket,
    interestOnPaper: 0,
    pastLegalCount: 0,
    pastLegalAmount: 0
  };
  for (const v of views) {
    if (v.stage === 'paid') continue;
    t.outstanding += v.balance;
    t.invoicesOpen++;
    byBucket[v.bucket] += v.balance;
    if (v.stage === 'overdue') {
      t.overdue += v.balance;
      t.invoicesOverdue++;
    }
    if (v.legalOn && v.daysToLegal < 0) {
      t.pastLegalCount++;
      t.pastLegalAmount += v.balance;
      t.interestOnPaper += v.interest;
    }
  }
  t.outstanding = round2(t.outstanding);
  t.overdue = round2(t.overdue);
  t.interestOnPaper = round2(t.interestOnPaper);
  t.pastLegalAmount = round2(t.pastLegalAmount);
  for (const b of BUCKETS) byBucket[b] = round2(byBucket[b]);
  return t;
}

export interface CustomerSummary {
  customer: Customer;
  views: InvoiceView[];
  outstanding: number;
  overdue: number;
  worstDaysOverdue: number;
}

export function summariseByCustomer(views: InvoiceView[], customers: Customer[]): CustomerSummary[] {
  return customers
    .map((customer) => {
      const mine = views.filter((v) => v.customer.id === customer.id);
      const open = mine.filter((v) => v.stage !== 'paid');
      return {
        customer,
        views: mine,
        outstanding: round2(open.reduce((a, v) => a + v.balance, 0)),
        overdue: round2(open.filter((v) => v.stage === 'overdue').reduce((a, v) => a + v.balance, 0)),
        worstDaysOverdue: open.reduce((m, v) => Math.max(m, v.daysOverdue), -9999)
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
}

/** Money collected (payments dated within [from, to]) */
export function collectedBetween(s: Snapshot, from: IsoDate, to: IsoDate): number {
  return round2(s.payments.filter((p) => p.paidOn >= from && p.paidOn <= to).reduce((a, p) => a + p.amount, 0));
}
