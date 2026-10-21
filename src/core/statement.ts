import type { IsoDate } from './dates';
import { statutoryInterest, INTEREST_MULTIPLE } from './legal';
import { round2 } from './money';
import type { InvoiceView } from './ledger';
import type { Business, Customer } from './types';

export interface StatementRow {
  number: string;
  acceptedOn: IsoDate;
  agreedDays: number;
  limitDays: number;
  legalDue: IsoDate;
  daysLate: number;
  principal: number;
  months: number;
  extraDays: number;
  interest: number;
}

export interface Statement {
  asOf: IsoDate;
  business: Business;
  customer: Customer;
  rows: StatementRow[];
  principal: number;
  interest: number;
  total: number;
  annualRatePct: number;
  bankRate: number;
  /** invoices not past the legal limit are listed but carry no interest */
  notes: string[];
}

/** Statement of dues with statutory interest, for the owner to review and send. */
export function buildStatement(business: Business, customer: Customer, views: InvoiceView[], asOf: IsoDate): Statement {
  const open = views.filter((v) => v.customer.id === customer.id && v.stage !== 'paid');
  const rows: StatementRow[] = open
    .sort((a, b) => a.legalDue.localeCompare(b.legalDue))
    .map((v) => {
      const r = statutoryInterest(v.balance, v.legalDue, asOf, business.bankRate);
      return {
        number: v.invoice.number,
        acceptedOn: v.acceptedOn,
        agreedDays: v.invoice.agreedDays,
        limitDays: v.limitDays,
        legalDue: v.legalDue,
        daysLate: r.daysLate,
        principal: v.balance,
        months: r.months,
        extraDays: r.extraDays,
        interest: r.interest
      };
    });
  const principal = round2(rows.reduce((a, r) => a + r.principal, 0));
  const interest = round2(rows.reduce((a, r) => a + r.interest, 0));
  return {
    asOf,
    business,
    customer,
    rows,
    principal,
    interest,
    total: round2(principal + interest),
    annualRatePct: INTEREST_MULTIPLE * business.bankRate,
    bankRate: business.bankRate,
    notes: [
      `Interest is shown at ${INTEREST_MULTIPLE} times the RBI bank rate (${business.bankRate}%), compounded at monthly rests, from the day after the legal payment limit.`,
      'The legal payment limit is the agreed period, not exceeding 45 days from acceptance with a written agreement, or 15 days without one.',
      'This statement is prepared for discussion. Please have it checked by your accountant before relying on it.'
    ]
  };
}
