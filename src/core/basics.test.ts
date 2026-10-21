import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, formatDate, isValidISO, todayISO, weekday } from './dates';
import { formatINR, formatINRShort, parseAmount, round2 } from './money';
import { normalizePhone, whatsappLink } from './phone';

describe('dates', () => {
  it('adds and subtracts days across month and year ends', () => {
    expect(addDays('2026-10-20', 10)).toBe('2026-10-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts days between dates with sign', () => {
    expect(daysBetween('2026-10-01', '2026-10-20')).toBe(19);
    expect(daysBetween('2026-10-20', '2026-10-01')).toBe(-19);
    expect(daysBetween('2026-10-20', '2026-10-20')).toBe(0);
  });
  it('adds calendar months and clamps the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('knows the weekday and validity', () => {
    expect(weekday('2026-10-20')).toBe(2);
    expect(weekday('2026-10-25')).toBe(0);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('2026-02-28')).toBe(true);
  });
  it('uses the Indian calendar day, not UTC', () => {
    expect(todayISO('Asia/Kolkata', new Date('2026-10-20T20:00:00Z'))).toBe('2026-10-21');
    expect(todayISO('Asia/Kolkata', new Date('2026-10-20T10:00:00Z'))).toBe('2026-10-20');
  });
  it('formats', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026');
  });
});

describe('money', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(480000)).toBe('₹4,80,000');
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(999)).toBe('₹999');
    expect(formatINR(12345678)).toBe('₹1,23,45,678');
    expect(formatINR(1234567.5, { decimals: true })).toBe('₹12,34,567.50');
    expect(formatINR(-2500)).toBe('-₹2,500');
  });
  it('shortens large amounts', () => {
    expect(formatINRShort(480000)).toBe('₹4.8L');
    expect(formatINRShort(20000000)).toBe('₹2Cr');
    expect(formatINRShort(950)).toBe('₹950');
  });
  it('parses amounts as exported by accounting software', () => {
    expect(parseAmount('₹ 1,25,000.50')).toBe(125000.5);
    expect(parseAmount('Rs. 500')).toBe(500);
    expect(parseAmount('(2,500)')).toBe(-2500);
    expect(parseAmount('1,00,000 Dr')).toBe(100000);
    expect(parseAmount('1,00,000 Cr')).toBe(-100000);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('12.5.5')).toBeNull();
  });
  it('rounds to paise', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('phone', () => {
  it('accepts common Indian formats', () => {
    for (const raw of ['98765 43210', '09876543210', '+91-98765-43210', '919876543210', '+91 9876543210']) {
      const p = normalizePhone(raw);
      expect(p.valid, raw).toBe(true);
      expect(p.e164, raw).toBe('+919876543210');
    }
    expect(normalizePhone('9876543210').pretty).toBe('+91 98765 43210');
  });
  it('rejects bad numbers', () => {
    expect(normalizePhone('12345').valid).toBe(false);
    expect(normalizePhone('5876543210').valid).toBe(false);
    expect(normalizePhone('').valid).toBe(false);
    expect(normalizePhone(undefined).valid).toBe(false);
  });
  it('keeps international numbers that carry a plus', () => {
    expect(normalizePhone('+14155552671').e164).toBe('+14155552671');
  });
  it('builds a WhatsApp link', () => {
    expect(whatsappLink('9876543210', 'hi there')).toBe('https://wa.me/919876543210?text=hi%20there');
    expect(whatsappLink('9876543210', 'a&b\nc')).toBe('https://wa.me/919876543210?text=a%26b%0Ac');
  });
});
