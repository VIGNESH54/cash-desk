import type { IsoDate } from './dates';

export type UdyamStatus = 'registered_micro' | 'registered_small' | 'not_registered' | 'unknown';
export type CustomerKind = 'business' | 'walk_in';
export type Tone = 'friendly' | 'formal';
export type Language = 'en' | 'hinglish';

export interface Business {
  id: string;
  name: string;
  ownerName?: string;
  ownerPhone?: string;
  udyamStatus: UdyamStatus;
  /** RBI bank rate in percent. Used for statutory interest (3x, compounded monthly). */
  bankRate: number;
  briefHour: number;
  /** Shown at the end of reminders, e.g. "UPI: shopname@bank" */
  payInstructions?: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  /** Where legal/accounts-level messages go, if different from the main contact */
  accountsPhone?: string;
  kind: CustomerKind;
  tone: Tone;
  /** Owner decision: use MSMED Act / 43B(h) wording with this customer */
  applyLegal: boolean;
  language: Language;
  optedOut: boolean;
  notes?: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  number: string;
  issueDate: IsoDate;
  /** Date goods/services were accepted. Falls back to issueDate. */
  acceptedOn?: IsoDate;
  agreedDays: number;
  writtenAgreement: boolean;
  amount: number;
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidOn: IsoDate;
  method?: string;
  note?: string;
}

export interface PromiseRecord {
  id: string;
  invoiceId: string;
  promisedOn: IsoDate;
  status: 'open' | 'kept' | 'broken';
  note?: string;
}

export interface ReminderLog {
  id: string;
  customerId: string;
  invoiceIds: string[];
  /** headline step of the message */
  step: string;
  /** step that applied to each invoice in the message */
  invoiceSteps: Record<string, string>;
  channel: 'whatsapp' | 'sms' | 'call' | 'manual';
  plannedFor: IsoDate;
  body: string;
  status: 'sent' | 'skipped';
  sentAt: string;
}

export interface TimelineEvent {
  id: string;
  customerId: string;
  invoiceId?: string;
  kind: 'reply' | 'call' | 'note';
  body: string;
  at: string;
}

export interface Snapshot {
  business: Business;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  promises: PromiseRecord[];
  reminders: ReminderLog[];
  events: TimelineEvent[];
}
