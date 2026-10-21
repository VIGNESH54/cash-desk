import type {
  Business,
  Customer,
  Invoice,
  Payment,
  PromiseRecord,
  ReminderLog,
  Snapshot,
  TimelineEvent
} from '../core/types';

type New<T> = Omit<T, 'id'>;

/** Everything the app needs from storage. Two implementations: demo (browser) and cloud (Supabase). */
export interface Repo {
  readonly mode: 'demo' | 'cloud';
  load(): Promise<Snapshot>;
  saveBusiness(patch: Partial<Omit<Business, 'id'>>): Promise<void>;
  addCustomers(list: New<Customer>[]): Promise<Customer[]>;
  updateCustomer(id: string, patch: Partial<New<Customer>>): Promise<void>;
  addInvoices(list: New<Invoice>[]): Promise<Invoice[]>;
  addPayments(list: New<Payment>[]): Promise<Payment[]>;
  addPromise(p: Omit<PromiseRecord, 'id' | 'status'>): Promise<PromiseRecord>;
  setPromiseStatus(id: string, status: PromiseRecord['status']): Promise<void>;
  addReminder(r: New<ReminderLog>): Promise<ReminderLog>;
  addEvent(e: New<TimelineEvent>): Promise<TimelineEvent>;
}

export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}
