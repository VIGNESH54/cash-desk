import { addDays, addMonths, daysBetween, type IsoDate } from './dates';
import { round2 } from './money';
import type { Business, Customer, Invoice } from './types';

/**
 * Payment rules for micro and small suppliers (MSMED Act, 2006, section 15 and 16),
 * as described in public tax guides. Not legal advice: a CA should confirm applicability.
 *
 * - With a written agreement the agreed period may not exceed 45 days from acceptance.
 * - Without one, the limit is 15 days from acceptance.
 * - After the limit, interest runs at three times the RBI bank rate, compounded with monthly rests.
 * - Section 43B(h) Income Tax: a buyer's deduction for a late-paid bill moves to the year of payment.
 */
export const MAX_AGREED_DAYS = 45;
export const NO_AGREEMENT_DAYS = 15;
export const INTEREST_MULTIPLE = 3;

export function acceptanceDate(inv: Pick<Invoice, 'acceptedOn' | 'issueDate'>): IsoDate {
  return inv.acceptedOn ?? inv.issueDate;
}

/** The date the buyer agreed to pay by (commercial due date). */
export function agreedDueDate(inv: Invoice): IsoDate {
  return addDays(acceptanceDate(inv), inv.agreedDays);
}

/** Days allowed by law for this invoice. */
export function legalLimitDays(inv: Invoice): number {
  return inv.writtenAgreement ? Math.min(inv.agreedDays, MAX_AGREED_DAYS) : NO_AGREEMENT_DAYS;
}

/** Last day the buyer can pay without interest starting to run. */
export function legalDueDate(inv: Invoice): IsoDate {
  return addDays(acceptanceDate(inv), legalLimitDays(inv));
}

export function isRegisteredSupplier(b: Pick<Business, 'udyamStatus'>): boolean {
  return b.udyamStatus === 'registered_micro' || b.udyamStatus === 'registered_small';
}

/** Legal wording is used only when you are a registered micro/small supplier selling to a business that you chose to apply it to. */
export function legalApplies(b: Pick<Business, 'udyamStatus'>, c: Pick<Customer, 'kind' | 'applyLegal'>): boolean {
  return isRegisteredSupplier(b) && c.kind === 'business' && c.applyLegal;
}

export interface InterestResult {
  interest: number;
  /** completed monthly rests */
  months: number;
  /** days left over after the last full month */
  extraDays: number;
  annualRatePct: number;
  daysLate: number;
}

/**
 * Statutory interest on `principal` from the day after `legalDue` to `asOf`.
 * Annual rate = 3 x bank rate. Compounded at each completed calendar month,
 * with simple interest for the days left over. An illustration for the statement,
 * not a ruling: the bank rate used is whatever the business has set.
 */
export function statutoryInterest(
  principal: number,
  legalDue: IsoDate,
  asOf: IsoDate,
  bankRatePct: number
): InterestResult {
  const daysLate = Math.max(0, daysBetween(legalDue, asOf));
  const annualRatePct = INTEREST_MULTIPLE * bankRatePct;
  if (daysLate === 0 || principal <= 0) {
    return { interest: 0, months: 0, extraDays: 0, annualRatePct, daysLate };
  }
  const monthly = annualRatePct / 100 / 12;
  let months = 0;
  while (addMonths(legalDue, months + 1) <= asOf) months++;
  let balance = principal * Math.pow(1 + monthly, months);
  const extraDays = daysBetween(addMonths(legalDue, months), asOf);
  balance += (balance * (annualRatePct / 100) * extraDays) / 365;
  return { interest: round2(balance - principal), months, extraDays, annualRatePct, daysLate };
}
