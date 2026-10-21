import type { SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot } from '../core/types';
import {
  businessFromRow,
  businessPatchToRow,
  customerFromRow,
  customerPatchToRow,
  customerToRow,
  eventFromRow,
  eventToRow,
  invoiceFromRow,
  invoiceToRow,
  paymentFromRow,
  paymentToRow,
  promiseFromRow,
  reminderFromRow,
  reminderToRow
} from './mappers';
import type { Repo } from './repo';

function fail(what: string, error: { message: string } | null): asserts error is null {
  if (error) throw new Error(`${what}: ${error.message}`);
}

const MAX_ROWS = 10_000;

/** Supabase storage. Row-level security means a signed-in user can only reach businesses they belong to. */
export class CloudRepo implements Repo {
  readonly mode = 'cloud' as const;

  constructor(
    private db: SupabaseClient,
    private businessId: string
  ) {}

  async load(): Promise<Snapshot> {
    const id = this.businessId;
    const q = (table: string) =>
      this.db
        .from(table)
        .select('*')
        .eq('business_id', id)
        .range(0, MAX_ROWS - 1);
    const [biz, customers, invoices, payments, promises, reminders, events] = await Promise.all([
      this.db.from('businesses').select('*').eq('id', id).single(),
      q('customers'),
      q('invoices'),
      q('payments'),
      q('promises'),
      q('reminders').order('sent_at', { ascending: true }),
      q('events').order('at', { ascending: true })
    ]);
    fail('Loading business', biz.error);
    fail('Loading customers', customers.error);
    fail('Loading invoices', invoices.error);
    fail('Loading payments', payments.error);
    fail('Loading promises', promises.error);
    fail('Loading reminders', reminders.error);
    fail('Loading events', events.error);
    return {
      business: businessFromRow(biz.data),
      customers: (customers.data ?? []).map(customerFromRow),
      invoices: (invoices.data ?? []).map(invoiceFromRow),
      payments: (payments.data ?? []).map(paymentFromRow),
      promises: (promises.data ?? []).map(promiseFromRow),
      reminders: (reminders.data ?? []).map(reminderFromRow),
      events: (events.data ?? []).map(eventFromRow)
    };
  }

  async saveBusiness(patch: Parameters<Repo['saveBusiness']>[0]) {
    const { error } = await this.db.from('businesses').update(businessPatchToRow(patch)).eq('id', this.businessId);
    fail('Saving business', error);
  }

  async addCustomers(list: Parameters<Repo['addCustomers']>[0]) {
    if (!list.length) return [];
    const { data, error } = await this.db
      .from('customers')
      .insert(list.map((c) => customerToRow(c, this.businessId)))
      .select();
    fail('Adding customers', error);
    return (data ?? []).map(customerFromRow);
  }

  async updateCustomer(id: string, patch: Parameters<Repo['updateCustomer']>[1]) {
    const { error } = await this.db
      .from('customers')
      .update(customerPatchToRow(patch))
      .eq('id', id)
      .eq('business_id', this.businessId);
    fail('Saving customer', error);
  }

  async addInvoices(list: Parameters<Repo['addInvoices']>[0]) {
    if (!list.length) return [];
    const { data, error } = await this.db
      .from('invoices')
      .insert(list.map((i) => invoiceToRow(i, this.businessId)))
      .select();
    fail('Adding invoices', error);
    return (data ?? []).map(invoiceFromRow);
  }

  async addPayments(list: Parameters<Repo['addPayments']>[0]) {
    if (!list.length) return [];
    const { data, error } = await this.db
      .from('payments')
      .insert(list.map((p) => paymentToRow(p, this.businessId)))
      .select();
    fail('Recording payment', error);
    return (data ?? []).map(paymentFromRow);
  }

  async addPromise(p: Parameters<Repo['addPromise']>[0]) {
    const { data, error } = await this.db
      .from('promises')
      .insert({
        business_id: this.businessId,
        invoice_id: p.invoiceId,
        promised_on: p.promisedOn,
        note: p.note ?? null
      })
      .select()
      .single();
    fail('Saving promise', error);
    return promiseFromRow(data!);
  }

  async setPromiseStatus(id: string, status: 'open' | 'kept' | 'broken') {
    const { error } = await this.db
      .from('promises')
      .update({ status, resolved_at: status === 'open' ? null : new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', this.businessId);
    fail('Updating promise', error);
  }

  async addReminder(r: Parameters<Repo['addReminder']>[0]) {
    const { data, error } = await this.db.from('reminders').insert(reminderToRow(r, this.businessId)).select().single();
    fail('Saving reminder history', error);
    return reminderFromRow(data!);
  }

  async addEvent(e: Parameters<Repo['addEvent']>[0]) {
    const { data, error } = await this.db.from('events').insert(eventToRow(e, this.businessId)).select().single();
    fail('Saving note', error);
    return eventFromRow(data!);
  }
}
