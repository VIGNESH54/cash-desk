import { addDays, type IsoDate } from './dates';
import { buildViews } from './ledger';
import { composeMessage } from './templates';
import type {
  Business,
  Customer,
  Invoice,
  Payment,
  PromiseRecord,
  ReminderLog,
  Snapshot,
  TimelineEvent
} from './types';

/**
 * Fictional demo business. Every name, number and amount is invented.
 * Dates are relative to `today`, so the demo always looks current.
 * Phone numbers use the reserved 98765 43xxx style and are not real.
 */
export function seedSnapshot(today: IsoDate): Snapshot {
  const ago = (n: number) => addDays(today, -n);

  const business: Business = {
    id: 'demo-business',
    name: 'Demo Fasteners Pvt Ltd',
    ownerName: 'Demo Owner',
    ownerPhone: '+919876543000',
    udyamStatus: 'registered_small',
    bankRate: 5.75,
    briefHour: 21,
    payInstructions: 'UPI demo.fasteners@examplebank'
  };

  const customers: Customer[] = [
    {
      id: 'c-sharma',
      name: 'Sharma Auto Components',
      contactPerson: 'Mr. Rao',
      phone: '+919876543101',
      accountsPhone: '+919876543102',
      kind: 'business',
      tone: 'formal',
      applyLegal: true,
      language: 'en',
      optedOut: false
    },
    {
      id: 'c-patel',
      name: 'Patel Engineering Works',
      contactPerson: 'Mr. Patel',
      phone: '+919876543111',
      accountsPhone: '+919876543112',
      kind: 'business',
      tone: 'formal',
      applyLegal: true,
      language: 'en',
      optedOut: false
    },
    {
      id: 'c-lakshmi',
      name: 'Lakshmi Packaging',
      contactPerson: 'Ms. Lakshmi',
      phone: '+919876543121',
      kind: 'business',
      tone: 'formal',
      applyLegal: true,
      language: 'en',
      optedOut: false
    },
    {
      id: 'c-kumar',
      name: 'Kumar Stores',
      contactPerson: 'Kumar',
      phone: '+919876543131',
      kind: 'walk_in',
      tone: 'friendly',
      applyLegal: false,
      language: 'hinglish',
      optedOut: false
    },
    {
      id: 'c-singh',
      name: 'Singh Traders',
      kind: 'business',
      tone: 'formal',
      applyLegal: false,
      language: 'en',
      optedOut: false,
      notes: 'Phone number missing: ask at next visit'
    },
    {
      id: 'c-mehta',
      name: 'Mehta Textiles',
      contactPerson: 'Mehta',
      phone: '+919876543141',
      kind: 'business',
      tone: 'formal',
      applyLegal: true,
      language: 'en',
      optedOut: false
    },
    {
      id: 'c-gupta',
      name: 'Gupta Enterprises',
      contactPerson: 'Mr. Gupta',
      phone: '+919876543151',
      kind: 'business',
      tone: 'formal',
      applyLegal: false,
      language: 'en',
      optedOut: false
    }
  ];

  const inv = (
    id: string,
    customerId: string,
    number: string,
    issuedAgo: number,
    amount: number,
    agreedDays = 30
  ): Invoice => ({
    id,
    customerId,
    number,
    issueDate: ago(issuedAgo),
    agreedDays,
    writtenAgreement: true,
    amount
  });

  const invoices: Invoice[] = [
    inv('i-2207', 'c-sharma', 'INV-2207', 41, 480000, 45),
    inv('i-2231', 'c-sharma', 'INV-2231', 12, 95000),
    inv('i-2150', 'c-patel', 'INV-2150', 75, 260000),
    inv('i-2214', 'c-lakshmi', 'INV-2214', 38, 115000),
    inv('i-2229', 'c-lakshmi', 'INV-2229', 20, 40000),
    inv('i-2189', 'c-kumar', 'INV-2189', 24, 32000, 15),
    inv('i-2101', 'c-singh', 'INV-2101', 55, 68000),
    inv('i-2188', 'c-mehta', 'INV-2188', 52, 150000),
    inv('i-2190', 'c-mehta', 'INV-2190', 38, 52000),
    inv('i-2090', 'c-gupta', 'INV-2090', 70, 210000)
  ];

  const payments: Payment[] = [
    { id: 'p1', invoiceId: 'i-2150', amount: 60000, paidOn: ago(20), method: 'NEFT' },
    { id: 'p2', invoiceId: 'i-2188', amount: 150000, paidOn: ago(3), method: 'UPI' },
    { id: 'p3', invoiceId: 'i-2190', amount: 52000, paidOn: today, method: 'UPI' }
  ];

  const promises: PromiseRecord[] = [
    {
      id: 'pr1',
      invoiceId: 'i-2214',
      promisedOn: addDays(today, 3),
      status: 'open',
      note: 'Said payment goes out this week'
    }
  ];

  const events: TimelineEvent[] = [
    {
      id: 'e1',
      customerId: 'c-lakshmi',
      invoiceId: 'i-2214',
      kind: 'reply',
      body: 'Will pay by the end of this week.',
      at: `${ago(2)}T08:10:00.000Z`
    },
    {
      id: 'e2',
      customerId: 'c-patel',
      invoiceId: 'i-2150',
      kind: 'reply',
      body: 'Will check with accounts.',
      at: `${ago(36)}T09:40:00.000Z`
    },
    {
      id: 'e3',
      customerId: 'c-sharma',
      kind: 'note',
      body: 'Big customer. Accounts contact is Ms. Iyer, direct line saved.',
      at: `${ago(30)}T07:00:00.000Z`
    }
  ];

  const base: Snapshot = { business, customers, invoices, payments, promises, reminders: [], events };

  // Past messages, written with the same templates the product uses today.
  const hist: { cust: string; inv: string[]; step: string; daysAgo: number }[] = [
    { cust: 'c-patel', inv: ['i-2150'], step: 'due', daysAgo: 45 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'nudge', daysAgo: 41 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'legal_passed', daysAgo: 39 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'accounts', daysAgo: 37 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'firm', daysAgo: 30 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'interest_1', daysAgo: 29 },
    { cust: 'c-patel', inv: ['i-2150'], step: 'weekly_1', daysAgo: 23 },
    { cust: 'c-lakshmi', inv: ['i-2214'], step: 'due', daysAgo: 8 },
    { cust: 'c-lakshmi', inv: ['i-2214'], step: 'nudge', daysAgo: 5 },
    { cust: 'c-kumar', inv: ['i-2189'], step: 'due', daysAgo: 9 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'due', daysAgo: 40 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'nudge', daysAgo: 36 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'accounts', daysAgo: 32 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'firm', daysAgo: 26 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'weekly_1', daysAgo: 19 },
    { cust: 'c-gupta', inv: ['i-2090'], step: 'weekly_2', daysAgo: 12 },
    { cust: 'c-mehta', inv: ['i-2188'], step: 'nudge', daysAgo: 12 },
    { cust: 'c-mehta', inv: ['i-2190'], step: 'due', daysAgo: 8 }
  ];

  const reminders: ReminderLog[] = hist.map((h, n) => {
    const date = ago(h.daysAgo);
    const snapThen: Snapshot = { ...base, payments: base.payments.filter((p) => p.paidOn <= date) };
    const views = buildViews(snapThen, date).filter((v) => h.inv.includes(v.invoice.id));
    const customer = customers.find((c) => c.id === h.cust)!;
    const body = composeMessage({ business, customer, views, step: h.step, today: date });
    return {
      id: `r${n + 1}`,
      customerId: h.cust,
      invoiceIds: h.inv,
      step: h.step,
      invoiceSteps: Object.fromEntries(h.inv.map((i) => [i, h.step])),
      channel: 'whatsapp',
      plannedFor: date,
      body,
      status: 'sent',
      sentAt: `${date}T05:00:00.000Z`
    };
  });

  return { ...base, reminders };
}
