import { describe, expect, it } from 'vitest';
import { agreedDueDate, legalApplies, legalDueDate, legalLimitDays, statutoryInterest } from './legal';
import type { Invoice } from './types';

const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'i',
  customerId: 'c',
  number: 'X',
  issueDate: '2026-01-01',
  agreedDays: 30,
  writtenAgreement: true,
  amount: 1000,
  ...over
});

describe('legal payment limit', () => {
  it('caps a written agreement at 45 days', () => {
    expect(legalLimitDays(inv({ agreedDays: 60 }))).toBe(45);
    expect(legalLimitDays(inv({ agreedDays: 30 }))).toBe(30);
    expect(legalLimitDays(inv({ agreedDays: 45 }))).toBe(45);
  });
  it('is 15 days without a written agreement, whatever was said', () => {
    expect(legalLimitDays(inv({ writtenAgreement: false, agreedDays: 60 }))).toBe(15);
  });
  it('counts from acceptance when given, else from the invoice date', () => {
    expect(legalDueDate(inv({ acceptedOn: '2026-01-05' }))).toBe('2026-02-04');
    expect(legalDueDate(inv())).toBe('2026-01-31');
    expect(agreedDueDate(inv({ agreedDays: 60 }))).toBe('2026-03-02');
    expect(legalDueDate(inv({ agreedDays: 60 }))).toBe('2026-02-15');
  });
});

describe('when legal wording applies', () => {
  it('needs a registered supplier, a business customer and the owner opting in', () => {
    const c = { kind: 'business' as const, applyLegal: true };
    expect(legalApplies({ udyamStatus: 'registered_small' }, c)).toBe(true);
    expect(legalApplies({ udyamStatus: 'registered_micro' }, c)).toBe(true);
    expect(legalApplies({ udyamStatus: 'unknown' }, c)).toBe(false);
    expect(legalApplies({ udyamStatus: 'not_registered' }, c)).toBe(false);
    expect(legalApplies({ udyamStatus: 'registered_small' }, { kind: 'walk_in', applyLegal: true })).toBe(false);
    expect(legalApplies({ udyamStatus: 'registered_small' }, { kind: 'business', applyLegal: false })).toBe(false);
  });
});

describe('statutory interest (3 x bank rate, monthly rests)', () => {
  it('is zero on or before the limit', () => {
    expect(statutoryInterest(100000, '2026-01-01', '2026-01-01', 6).interest).toBe(0);
    expect(statutoryInterest(100000, '2026-01-10', '2026-01-01', 6).interest).toBe(0);
  });
  it('is simple interest inside the first month', () => {
    // 18% a year for 30 days
    const r = statutoryInterest(100000, '2026-01-01', '2026-01-31', 6);
    expect(r.annualRatePct).toBe(18);
    expect(r.months).toBe(0);
    expect(r.interest).toBe(1479.45);
  });
  it('compounds at each completed month', () => {
    expect(statutoryInterest(100000, '2026-01-01', '2026-02-01', 6).interest).toBe(1500);
    expect(statutoryInterest(100000, '2026-01-01', '2026-03-01', 6).interest).toBe(3022.5);
  });
  it('adds simple interest for the days after the last full month', () => {
    // 1 month compounded = 101500, then 10 days at 18% on 101500
    const r = statutoryInterest(100000, '2026-01-01', '2026-02-11', 6);
    expect(r.months).toBe(1);
    expect(r.extraDays).toBe(10);
    expect(r.interest).toBe(Math.round((101500 + (101500 * 0.18 * 10) / 365 - 100000) * 100) / 100);
  });
  it('scales with the bank rate', () => {
    const lo = statutoryInterest(100000, '2026-01-01', '2026-06-01', 5.75).interest;
    const hi = statutoryInterest(100000, '2026-01-01', '2026-06-01', 6.5).interest;
    expect(hi).toBeGreaterThan(lo);
  });
});
