import type { Business, Customer, Invoice, Payment, PromiseRecord, ReminderLog, TimelineEvent } from '../core/types';

// Database rows use snake_case, the app uses camelCase. Kept in one place and unit-tested.

type Row = Record<string, unknown>;
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

export const businessFromRow = (r: Row): Business => ({
  id: r.id as string,
  name: r.name as string,
  ownerName: opt(r.owner_name as string | null),
  ownerPhone: opt(r.owner_phone as string | null),
  udyamStatus: r.udyam_status as Business['udyamStatus'],
  bankRate: num(r.bank_rate),
  briefHour: num(r.brief_hour),
  payInstructions: opt(r.pay_instructions as string | null)
});

export function businessPatchToRow(p: Partial<Omit<Business, 'id'>>): Row {
  const out: Row = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.ownerName !== undefined) out.owner_name = p.ownerName || null;
  if (p.ownerPhone !== undefined) out.owner_phone = p.ownerPhone || null;
  if (p.udyamStatus !== undefined) out.udyam_status = p.udyamStatus;
  if (p.bankRate !== undefined) out.bank_rate = p.bankRate;
  if (p.briefHour !== undefined) out.brief_hour = p.briefHour;
  if (p.payInstructions !== undefined) out.pay_instructions = p.payInstructions || null;
  return out;
}

export const customerFromRow = (r: Row): Customer => ({
  id: r.id as string,
  name: r.name as string,
  contactPerson: opt(r.contact_person as string | null),
  phone: opt(r.phone as string | null),
  accountsPhone: opt(r.accounts_phone as string | null),
  kind: r.kind as Customer['kind'],
  tone: r.tone as Customer['tone'],
  applyLegal: !!r.apply_legal,
  language: r.language as Customer['language'],
  optedOut: !!r.opted_out,
  notes: opt(r.notes as string | null)
});

export function customerPatchToRow(p: Partial<Omit<Customer, 'id'>>): Row {
  const out: Row = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.contactPerson !== undefined) out.contact_person = p.contactPerson || null;
  if (p.phone !== undefined) out.phone = p.phone || null;
  if (p.accountsPhone !== undefined) out.accounts_phone = p.accountsPhone || null;
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.tone !== undefined) out.tone = p.tone;
  if (p.applyLegal !== undefined) out.apply_legal = p.applyLegal;
  if (p.language !== undefined) out.language = p.language;
  if (p.optedOut !== undefined) out.opted_out = p.optedOut;
  if (p.notes !== undefined) out.notes = p.notes || null;
  return out;
}

export const invoiceFromRow = (r: Row): Invoice => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  number: r.number as string,
  issueDate: r.issue_date as string,
  acceptedOn: opt(r.accepted_on as string | null),
  agreedDays: num(r.agreed_days),
  writtenAgreement: !!r.written_agreement,
  amount: num(r.amount),
  notes: opt(r.notes as string | null)
});

export const invoiceToRow = (i: Omit<Invoice, 'id'>, businessId: string): Row => ({
  business_id: businessId,
  customer_id: i.customerId,
  number: i.number,
  issue_date: i.issueDate,
  accepted_on: i.acceptedOn ?? null,
  agreed_days: i.agreedDays,
  written_agreement: i.writtenAgreement,
  amount: i.amount,
  notes: i.notes ?? null
});

export const paymentFromRow = (r: Row): Payment => ({
  id: r.id as string,
  invoiceId: r.invoice_id as string,
  amount: num(r.amount),
  paidOn: r.paid_on as string,
  method: opt(r.method as string | null),
  note: opt(r.note as string | null)
});

export const paymentToRow = (p: Omit<Payment, 'id'>, businessId: string): Row => ({
  business_id: businessId,
  invoice_id: p.invoiceId,
  amount: p.amount,
  paid_on: p.paidOn,
  method: p.method ?? null,
  note: p.note ?? null
});

export const promiseFromRow = (r: Row): PromiseRecord => ({
  id: r.id as string,
  invoiceId: r.invoice_id as string,
  promisedOn: r.promised_on as string,
  status: r.status as PromiseRecord['status'],
  note: opt(r.note as string | null)
});

export const reminderFromRow = (r: Row): ReminderLog => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  invoiceIds: (r.invoice_ids as string[]) ?? [],
  step: r.step as string,
  invoiceSteps: (r.invoice_steps as Record<string, string>) ?? {},
  channel: r.channel as ReminderLog['channel'],
  plannedFor: r.planned_for as string,
  body: r.body as string,
  status: r.status as ReminderLog['status'],
  sentAt: r.sent_at as string
});

export const reminderToRow = (r: Omit<ReminderLog, 'id'>, businessId: string): Row => ({
  business_id: businessId,
  customer_id: r.customerId,
  invoice_ids: r.invoiceIds,
  step: r.step,
  invoice_steps: r.invoiceSteps,
  channel: r.channel,
  planned_for: r.plannedFor,
  body: r.body,
  status: r.status,
  sent_at: r.sentAt
});

export const eventFromRow = (r: Row): TimelineEvent => ({
  id: r.id as string,
  customerId: r.customer_id as string,
  invoiceId: opt(r.invoice_id as string | null),
  kind: r.kind as TimelineEvent['kind'],
  body: r.body as string,
  at: r.at as string
});

export const eventToRow = (e: Omit<TimelineEvent, 'id'>, businessId: string): Row => ({
  business_id: businessId,
  customer_id: e.customerId,
  invoice_id: e.invoiceId ?? null,
  kind: e.kind,
  body: e.body,
  at: e.at
});

export const customerToRow = (c: Omit<Customer, 'id'>, businessId: string): Row => ({
  business_id: businessId,
  ...customerPatchToRow(c)
});
