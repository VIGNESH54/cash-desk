import { describe, expect, it } from 'vitest';
import {
  businessFromRow,
  businessPatchToRow,
  customerFromRow,
  customerPatchToRow,
  invoiceFromRow,
  invoiceToRow,
  paymentFromRow,
  reminderFromRow,
  reminderToRow
} from '../data/mappers';

describe('row mappers', () => {
  it('reads numeric strings from Postgres numeric columns as numbers', () => {
    const inv = invoiceFromRow({
      id: 'i',
      customer_id: 'c',
      number: '1',
      issue_date: '2026-10-01',
      agreed_days: 30,
      written_agreement: false,
      amount: '12500.50',
      accepted_on: null,
      notes: null
    });
    expect(inv.amount).toBe(12500.5);
    expect(inv.acceptedOn).toBeUndefined();
  });

  it('round-trips an invoice', () => {
    const row = invoiceToRow(
      { customerId: 'c', number: 'A1', issueDate: '2026-10-01', agreedDays: 45, writtenAgreement: true, amount: 100 },
      'b'
    );
    expect(row).toMatchObject({
      business_id: 'b',
      customer_id: 'c',
      agreed_days: 45,
      written_agreement: true,
      accepted_on: null
    });
    expect(invoiceFromRow({ id: 'x', ...row }).writtenAgreement).toBe(true);
  });

  it('patch mappers only include fields that are present and turn empty text into null', () => {
    expect(customerPatchToRow({ phone: '' })).toEqual({ phone: null });
    expect(customerPatchToRow({ optedOut: true })).toEqual({ opted_out: true });
    expect(businessPatchToRow({ bankRate: 5.75 })).toEqual({ bank_rate: 5.75 });
    expect(businessPatchToRow({})).toEqual({});
  });

  it('keeps per-invoice steps on reminders', () => {
    const row = reminderToRow(
      {
        customerId: 'c',
        invoiceIds: ['i'],
        step: 'firm',
        invoiceSteps: { i: 'firm' },
        channel: 'whatsapp',
        plannedFor: '2026-10-20',
        body: 'hi',
        status: 'sent',
        sentAt: '2026-10-20T04:00:00Z'
      },
      'b'
    );
    expect(reminderFromRow({ id: 'r', ...row }).invoiceSteps).toEqual({ i: 'firm' });
  });

  it('defaults safely when optional columns are null', () => {
    const c = customerFromRow({
      id: 'c',
      name: 'N',
      kind: 'business',
      tone: 'formal',
      language: 'en',
      apply_legal: null,
      opted_out: null
    });
    expect(c.applyLegal).toBe(false);
    expect(c.optedOut).toBe(false);
    expect(
      businessFromRow({ id: 'b', name: 'B', udyam_status: 'unknown', bank_rate: '5.75', brief_hour: 21 }).bankRate
    ).toBe(5.75);
    expect(paymentFromRow({ id: 'p', invoice_id: 'i', amount: '10', paid_on: '2026-10-01' }).amount).toBe(10);
  });
});
