import { useMemo, useState } from 'react';
import { findHeaderRow, parseCsv, planImport, readRows, suggestMapping, type ColumnMap } from '../core/csv';
import { normalizePhone } from '../core/phone';
import { Money, Field, Empty } from './ui';
import { useApp } from './Store';
import { go } from './router';

const FIELDS: { key: keyof ColumnMap; label: string; need?: boolean }[] = [
  { key: 'party', label: 'Customer name', need: true },
  { key: 'invoiceNo', label: 'Invoice number', need: true },
  { key: 'date', label: 'Invoice date', need: true },
  { key: 'amount', label: 'Invoice amount' },
  { key: 'pending', label: 'Pending / balance' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'creditDays', label: 'Credit days' },
  { key: 'phone', label: 'Phone' },
  { key: 'contact', label: 'Contact person' }
];

const TEMPLATE =
  'Customer,Invoice No,Date,Amount,Pending,Phone,Contact\nSample Traders,INV-001,2026-09-01,25000,25000,9876543210,Mr Rao\n';

export default function ImportPage() {
  const { snap, today, repo, run } = useApp();
  const [text, setText] = useState('');
  const [map, setMap] = useState<ColumnMap>({});
  const [terms, setTerms] = useState('30');
  const [done, setDone] = useState<string | null>(null);

  const table = useMemo(() => (text.trim() ? parseCsv(text) : []), [text]);
  const headerRow = useMemo(() => (table.length ? findHeaderRow(table) : 0), [table]);
  const headers = table[headerRow] ?? [];
  const effective = useMemo(() => (Object.keys(map).length ? map : suggestMapping(headers)), [map, headers]);

  const plan = useMemo(() => {
    if (!table.length) return null;
    const rows = readRows(table, headerRow, effective);
    return planImport(rows, {
      today,
      defaultTermsDays: Number(terms) || 30,
      existingCustomers: new Set(snap.customers.map((c) => c.name.trim().toLowerCase())),
      existingInvoices: new Set(
        snap.invoices.map(
          (i) => `${snap.customers.find((c) => c.id === i.customerId)?.name.toLowerCase()}|${i.number.toLowerCase()}`
        )
      )
    });
  }, [table, headerRow, effective, terms, today, snap]);

  const readFile = async (f: File) => {
    setDone(null);
    setMap({});
    setText(await f.text());
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cashdesk-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const commit = async () => {
    if (!plan) return;
    const res = await run(async () => {
      const byName = new Map(snap.customers.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const fresh = plan.customers.filter((c) => !byName.has(c.name.trim().toLowerCase()));
      const made = await repo.addCustomers(
        fresh.map((c) => ({
          name: c.name,
          phone: c.phoneValid ? normalizePhone(c.phone).e164 : undefined,
          contactPerson: c.contact,
          kind: 'business' as const,
          tone: 'formal' as const,
          applyLegal: false,
          language: 'en' as const,
          optedOut: false
        }))
      );
      for (const m of made) byName.set(m.name.trim().toLowerCase(), m.id);
      const invs = plan.invoices.map((i) => ({
        customerId: byName.get(i.party.trim().toLowerCase())!,
        number: i.number,
        issueDate: i.issueDate,
        agreedDays: i.agreedDays,
        writtenAgreement: false,
        amount: i.amount
      }));
      const createdInv = await repo.addInvoices(invs);
      const pays = plan.invoices
        .map((i, idx) => ({ i, inv: createdInv[idx] }))
        .filter((x) => x.i.alreadyPaid > 0 && x.inv)
        .map((x) => ({
          invoiceId: x.inv!.id,
          amount: x.i.alreadyPaid,
          paidOn: x.i.issueDate,
          method: 'Before import'
        }));
      await repo.addPayments(pays);
      return `Imported ${createdInv.length} invoices and ${made.length} new customers.`;
    });
    if (res) {
      setDone(res);
      setText('');
      setMap({});
    }
  };

  return (
    <section>
      <h1>Import</h1>
      <p className="lede">
        Bring in your outstanding bills from Tally, Busy, Vyapar or any Excel sheet saved as CSV. Nothing is sent to
        anyone.
      </p>
      {done && (
        <div className="notice ok">
          {done}{' '}
          <button className="btn" onClick={() => go('/today')}>
            Go to Today
          </button>
        </div>
      )}
      <div className="card form">
        <div className="row wrap">
          <input
            aria-label="Choose a CSV file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />
          <button className="btn ghost" onClick={download}>
            Download sample CSV
          </button>
        </div>
        <Field label="…or paste rows here" hint="Include the header row">
          <textarea
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMap({});
              setDone(null);
            }}
            placeholder="Customer,Invoice No,Date,Amount,Pending"
          />
        </Field>
      </div>

      {table.length > 0 && plan && (
        <>
          <h2>Check the columns</h2>
          <div className="card form two">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label + (f.need ? ' *' : '')}>
                <select
                  value={effective[f.key] ?? ''}
                  onChange={(e) =>
                    setMap({ ...effective, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                >
                  <option value="">— none —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <Field label="Default payment terms (days)" hint="Used when the sheet has no due date or credit days">
              <input value={terms} inputMode="numeric" onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </div>

          <h2>Preview</h2>
          <div className="stats">
            <div className="stat">
              <span>Invoices to add</span>
              <strong>{plan.invoices.length}</strong>
            </div>
            <div className="stat">
              <span>New customers</span>
              <strong>
                {
                  plan.customers.filter(
                    (c) => !snap.customers.some((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase())
                  ).length
                }
              </strong>
            </div>
            <div className="stat">
              <span>Rows skipped</span>
              <strong>{plan.skipped.length}</strong>
            </div>
            <div className="stat">
              <span>Total pending</span>
              <strong>
                <Money v={plan.invoices.reduce((a, i) => a + (i.amount - i.alreadyPaid), 0)} />
              </strong>
            </div>
          </div>
          {plan.warnings.length > 0 && (
            <div className="notice">
              {plan.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          {plan.skipped.length > 0 && (
            <details className="card">
              <summary>{plan.skipped.length} rows skipped</summary>
              <ul>
                {plan.skipped.slice(0, 50).map((s, i) => (
                  <li key={i}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {plan.invoices.length === 0 ? (
            <Empty>No usable rows yet. Check the column choices above.</Empty>
          ) : (
            <div className="card table-wrap" tabIndex={0} role="region" aria-label="Import preview">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th className="r">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.invoices.slice(0, 8).map((i, k) => (
                    <tr key={k}>
                      <td>{i.party}</td>
                      <td className="mono">{i.number}</td>
                      <td>{i.issueDate}</td>
                      <td className="r mono">{(i.amount - i.alreadyPaid).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.invoices.length > 8 && <p className="foot">…and {plan.invoices.length - 8} more</p>}
            </div>
          )}
          <button className="btn primary big" disabled={plan.invoices.length === 0} onClick={commit}>
            Import {plan.invoices.length} invoices
          </button>
        </>
      )}
    </section>
  );
}
