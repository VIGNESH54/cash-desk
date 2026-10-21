import { addDays, daysBetween, isValidISO, type IsoDate } from './dates';
import { parseAmount, round2 } from './money';
import { normalizePhone } from './phone';

// ----------------------------------------------------------------------------- parsing

/** RFC 4180 style CSV parser. Detects comma, semicolon, tab or pipe. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t', '|'].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ----------------------------------------------------------------------------- columns

export interface ColumnMap {
  party?: number;
  invoiceNo?: number;
  date?: number;
  dueDate?: number;
  amount?: number;
  pending?: number;
  phone?: number;
  contact?: number;
  creditDays?: number;
}

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Guesses which column is which from the header names (Tally, Busy, Vyapar and hand-made sheets). */
export function suggestMapping(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((raw, i) => {
    const h = norm(raw);
    if (!h) return;
    const set = (k: keyof ColumnMap) => {
      if (map[k] === undefined) map[k] = i;
    };
    if (/\bdue\b.*\b(date|on)\b|^due on$|^due date$|payment due/.test(h)) set('dueDate');
    else if (/\bdate\b/.test(h)) set('date');
    else if (/pending|outstanding|balance|o\/s|receivable|unpaid|due amount/.test(h)) set('pending');
    else if (/credit (days|period)|terms|payment days/.test(h)) set('creditDays');
    else if (/phone|mobile|\bmob\b|whatsapp|cell|contact no/.test(h)) set('phone');
    else if (/contact person|attention|\bperson\b|proprietor|owner/.test(h)) set('contact');
    else if (
      /(invoice|inv|bill|voucher|ref)\b.*(no|number|num|#)|^(invoice|inv|bill|ref|reference|voucher)$|ref no|bill no/.test(
        h
      )
    )
      set('invoiceNo');
    else if (/amount|total|value|debit|invoice value/.test(h)) set('amount');
    else if (/party|customer|client|buyer|debtor|ledger|^name$|company/.test(h)) set('party');
  });
  return map;
}

/** Finds the header row (Tally puts title lines above it). */
export function findHeaderRow(table: string[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(table.length, 12); i++) {
    const m = suggestMapping(table[i]);
    const score = Object.values(m).filter((v) => v !== undefined).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------- values

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

function iso(y: number, m: number, d: number): IsoDate | null {
  if (y < 100) y += 2000;
  const s = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidISO(s) ? s : null;
}

/** Indian day-first dates, ISO, "12-Oct-2026", "12 October 26" and Excel serial numbers. */
export function parseDate(raw: string | undefined): IsoDate | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return iso(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]*(\d{2,4})$/))) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mon ? iso(+m[3], mon, +m[1]) : null;
  }
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
    }
  }
  return null;
}

// ----------------------------------------------------------------------------- rows

export interface ImportRow {
  line: number;
  party: string;
  invoiceNo: string;
  issueDate: IsoDate | null;
  dueDate: IsoDate | null;
  amount: number | null;
  pending: number | null;
  creditDays: number | null;
  phone?: string;
  contact?: string;
  problems: string[];
}

export function readRows(table: string[][], headerRow: number, map: ColumnMap): ImportRow[] {
  const rows: ImportRow[] = [];
  for (let i = headerRow + 1; i < table.length; i++) {
    const r = table[i];
    const get = (k: keyof ColumnMap) => (map[k] === undefined ? '' : (r[map[k]!] ?? '').trim());
    const party = get('party');
    const invoiceNo = get('invoiceNo');
    // skip totals and blank lines
    if (!party && !invoiceNo) continue;
    if (/^(grand )?total/i.test(party)) continue;
    const cd = parseAmount(get('creditDays'));
    rows.push({
      line: i + 1,
      party,
      invoiceNo,
      issueDate: parseDate(get('date')),
      dueDate: parseDate(get('dueDate')),
      amount: parseAmount(get('amount')),
      pending: parseAmount(get('pending')),
      creditDays: cd === null ? null : Math.round(cd),
      phone: get('phone') || undefined,
      contact: get('contact') || undefined,
      problems: []
    });
  }
  return rows;
}

// ----------------------------------------------------------------------------- plan

export interface PlannedCustomer {
  name: string;
  phone?: string;
  contact?: string;
  phoneValid: boolean;
}
export interface PlannedInvoice {
  party: string;
  number: string;
  issueDate: IsoDate;
  agreedDays: number;
  amount: number;
  /** already paid before import (original amount minus pending) */
  alreadyPaid: number;
}
export interface ImportPlan {
  customers: PlannedCustomer[];
  invoices: PlannedInvoice[];
  skipped: { line: number; reason: string }[];
  warnings: string[];
}

export interface ImportContext {
  today: IsoDate;
  defaultTermsDays: number;
  existingCustomers: Set<string>;
  /** "lower(customer)|lower(number)" */
  existingInvoices: Set<string>;
}

export function planImport(rows: ImportRow[], ctx: ImportContext): ImportPlan {
  const plan: ImportPlan = { customers: [], invoices: [], skipped: [], warnings: [] };
  const seenInvoice = new Set<string>();
  const customers = new Map<string, PlannedCustomer>();

  for (const r of rows) {
    const skip = (reason: string) => plan.skipped.push({ line: r.line, reason });
    if (!r.party) {
      skip('No customer name');
      continue;
    }
    if (!r.invoiceNo) {
      skip('No invoice number');
      continue;
    }

    let amount = r.amount;
    let paid = 0;
    if (amount !== null && r.pending !== null) {
      paid = Math.max(0, round2(amount - r.pending));
      if (r.pending > amount) amount = r.pending;
    } else if (amount === null && r.pending !== null) amount = r.pending;
    if (amount === null || amount <= 0) {
      skip('No positive amount');
      continue;
    }
    if (paid >= amount - 0.005) {
      skip('Already fully paid');
      continue;
    }

    let issue = r.issueDate;
    let terms = r.creditDays !== null && r.creditDays >= 0 && r.creditDays <= 365 ? r.creditDays : ctx.defaultTermsDays;
    if (r.dueDate && issue) {
      const diff = daysBetween(issue, r.dueDate);
      if (diff >= 0 && diff <= 365) terms = diff;
      else plan.warnings.push(`Line ${r.line}: due date is before the invoice date; used ${ctx.defaultTermsDays} days`);
    } else if (r.dueDate && !issue) {
      issue = addDays(r.dueDate, -terms);
    }
    if (!issue) {
      skip('No invoice date or due date');
      continue;
    }

    const key = `${r.party.toLowerCase()}|${r.invoiceNo.toLowerCase()}`;
    if (ctx.existingInvoices.has(key)) {
      skip('Already in Cash Desk');
      continue;
    }
    if (seenInvoice.has(key)) {
      skip('Duplicate of an earlier line');
      continue;
    }
    seenInvoice.add(key);

    const lc = r.party.toLowerCase();
    if (!customers.has(lc)) {
      const phone = r.phone ? normalizePhone(r.phone) : undefined;
      if (r.phone && phone && !phone.valid)
        plan.warnings.push(`Line ${r.line}: "${r.phone}" is not a valid phone number`);
      customers.set(lc, {
        name: r.party,
        phone: phone?.valid ? phone.e164 : undefined,
        contact: r.contact,
        phoneValid: !!phone?.valid
      });
    }
    plan.invoices.push({
      party: r.party,
      number: r.invoiceNo,
      issueDate: issue,
      agreedDays: terms,
      amount: round2(amount),
      alreadyPaid: paid
    });
  }

  plan.customers = [...customers.values()].filter((c) => !ctx.existingCustomers.has(c.name.toLowerCase()));
  const noPhone = [...customers.values()].filter((c) => !c.phoneValid).length;
  if (noPhone)
    plan.warnings.push(
      `${noPhone} customer${noPhone === 1 ? '' : 's'} without a valid phone number: reminders cannot be sent until you add one`
    );
  return plan;
}
