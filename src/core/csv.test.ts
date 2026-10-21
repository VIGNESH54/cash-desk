import { describe, expect, it } from 'vitest';
import { findHeaderRow, parseCsv, parseDate, planImport, readRows, suggestMapping } from './csv';

const ctx = (over: Partial<Parameters<typeof planImport>[1]> = {}) => ({
  today: '2026-10-20',
  defaultTermsDays: 30,
  existingCustomers: new Set<string>(),
  existingInvoices: new Set<string>(),
  ...over
});

describe('csv parsing', () => {
  it('handles quoted commas, quotes and line breaks inside cells', () => {
    const t = parseCsv('a,b,c\n"1,25,000","say ""hi""","line1\nline2"\n');
    expect(t).toEqual([
      ['a', 'b', 'c'],
      ['1,25,000', 'say "hi"', 'line1\nline2']
    ]);
  });
  it('detects semicolon and tab delimiters and strips a BOM', () => {
    expect(parseCsv('﻿a;b;c\n1;2;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });
  it('ignores blank lines and Windows line endings', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });
});

describe('dates in Indian exports', () => {
  it('reads day-first, ISO, month names and Excel serials', () => {
    expect(parseDate('05/11/2026')).toBe('2026-11-05');
    expect(parseDate('5-11-26')).toBe('2026-11-05');
    expect(parseDate('2026-11-05')).toBe('2026-11-05');
    expect(parseDate('12-Aug-2026')).toBe('2026-08-12');
    expect(parseDate('15 September 2026')).toBe('2026-09-15');
    expect(parseDate('45930')).toBe(new Date(Date.UTC(1899, 11, 30) + 45930 * 86_400_000).toISOString().slice(0, 10));
  });
  it('rejects nonsense', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('hello')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

const TALLY = [
  'Bills Receivable,,,,',
  'Demo Fasteners,,,,',
  "Date,Ref. No.,Party's Name,Pending Amount,Due on",
  '12-Aug-2026,INV-1,Acme Ltd,"1,25,000.00",11-Sep-2026',
  '15-Aug-26,INV-2,Beta Co,"80,000.00",',
  'Grand Total,,,"2,05,000.00",'
].join('\n');

describe('importing a Tally "Bills Receivable" export', () => {
  const table = parseCsv(TALLY);
  it('finds the header under the title lines', () => {
    expect(findHeaderRow(table)).toBe(2);
  });
  it('guesses the columns', () => {
    expect(suggestMapping(table[2])).toEqual({ date: 0, invoiceNo: 1, party: 2, pending: 3, dueDate: 4 });
  });
  it('turns rows into invoices and skips the total line', () => {
    const h = findHeaderRow(table);
    const rows = readRows(table, h, suggestMapping(table[h]));
    expect(rows).toHaveLength(2);
    const plan = planImport(rows, ctx());
    expect(plan.invoices).toEqual([
      { party: 'Acme Ltd', number: 'INV-1', issueDate: '2026-08-12', agreedDays: 30, amount: 125000, alreadyPaid: 0 },
      { party: 'Beta Co', number: 'INV-2', issueDate: '2026-08-15', agreedDays: 30, amount: 80000, alreadyPaid: 0 }
    ]);
    expect(plan.customers.map((c) => c.name)).toEqual(['Acme Ltd', 'Beta Co']);
    expect(plan.warnings.join(' ')).toMatch(/2 customers without a valid phone number/);
  });
});

describe('importing a hand-made sheet', () => {
  const sheet = [
    'Customer,Invoice No,Invoice Date,Credit Days,Amount,Balance,Mobile',
    'Acme Ltd,A-1,01/09/2026,45,"1,00,000","40,000",98765 43210',
    'Acme Ltd,A-2,10/09/2026,45,"20,000","20,000",98765 43210',
    'Beta Co,B-1,01/09/2026,,"5,000",0,12345',
    'Gamma,,01/09/2026,30,"5,000","5,000",',
    'Delta,D-1,not a date,30,"5,000","5,000",',
    'Epsilon,E-1,01/09/2026,30,"7,000","7,000",12345',
    'Acme Ltd,A-1,01/09/2026,45,"1,00,000","40,000",98765 43210'
  ].join('\n');
  const table = parseCsv(sheet);
  const rows = readRows(table, 0, suggestMapping(table[0]));
  const plan = planImport(rows, ctx());

  it('uses credit days, records what was already paid, and groups customers', () => {
    expect(plan.invoices[0]).toMatchObject({ number: 'A-1', agreedDays: 45, amount: 100000, alreadyPaid: 60000 });
    expect(plan.invoices[1]).toMatchObject({ number: 'A-2', alreadyPaid: 0 });
    expect(plan.customers.find((c) => c.name === 'Acme Ltd')!.phone).toBe('+919876543210');
  });
  it('explains every row it skips', () => {
    const reasons = plan.skipped.map((s) => s.reason);
    expect(reasons).toContain('Already fully paid');
    expect(reasons).toContain('No invoice number');
    expect(reasons).toContain('No invoice date or due date');
    expect(reasons).toContain('Duplicate of an earlier line');
  });
  it('does not import what is already in the system', () => {
    const again = planImport(
      rows,
      ctx({ existingInvoices: new Set(['acme ltd|a-1']), existingCustomers: new Set(['acme ltd']) })
    );
    expect(again.skipped.map((s) => s.reason)).toContain('Already in Cash Desk');
    expect(again.invoices.map((i) => i.number)).toEqual(['A-2', 'E-1']);
    expect(again.customers.map((c) => c.name)).not.toContain('Acme Ltd');
  });
  it('warns about bad phone numbers', () => {
    expect(plan.warnings.join(' ')).toContain('"12345" is not a valid phone number');
  });
});
