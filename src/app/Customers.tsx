import { useState } from 'react';
import { summariseByCustomer } from '../core/ledger';
import { formatDate, formatShort } from '../core/dates';
import { normalizePhone } from '../core/phone';
import { legalApplies } from '../core/legal';
import { stepLabel } from '../core/templates';
import type { Customer } from '../core/types';
import { Money, Pill, stagePill, Modal, Field, Empty } from './ui';
import { useApp } from './Store';
import { go } from './router';

export function CustomerList() {
  const { views, snap, repo, run } = useApp();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const rows = summariseByCustomer(views, snap.customers).filter((s) =>
    s.customer.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section>
      <h1>
        Customers{' '}
        <button className="btn" onClick={() => setAdding(true)}>
          Add
        </button>
      </h1>
      <input
        aria-label="Search customers"
        className="search"
        placeholder="Search customers"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {rows.length === 0 ? (
        <Empty>No customers match. Import a sheet or add one.</Empty>
      ) : (
        <div className="card list">
          {rows.map((s) => (
            <a key={s.customer.id} className="line" href={`#/customers/${s.customer.id}`}>
              <div>
                <strong>{s.customer.name}</strong>
                <div className="sub">
                  {s.outstanding > 0 ? (
                    <>
                      {s.overdue > 0 ? (
                        <>
                          Overdue <Money v={s.overdue} />
                        </>
                      ) : (
                        'Nothing overdue'
                      )}
                    </>
                  ) : (
                    'All paid'
                  )}
                  {s.customer.optedOut && ' · opted out'}
                  {!s.customer.phone && ' · no phone'}
                </div>
              </div>
              <Money v={s.outstanding} />
            </a>
          ))}
        </div>
      )}
      {adding && (
        <NewCustomer
          onClose={() => setAdding(false)}
          onSave={async (c) => {
            const made = await run(() => repo.addCustomers([c]));
            setAdding(false);
            if (made?.[0]) go(`/customers/${made[0].id}`);
          }}
        />
      )}
    </section>
  );
}

function NewCustomer({ onClose, onSave }: { onClose(): void; onSave(c: Omit<Customer, 'id'>): void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<'business' | 'walk_in'>('business');
  const bad = phone.trim() !== '' && !normalizePhone(phone).valid;
  return (
    <Modal title="Add customer" onClose={onClose}>
      <Field label="Name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field
        label="WhatsApp number"
        hint={bad ? 'This number does not look valid' : 'Optional now, needed to send reminders'}
      >
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </Field>
      <Field label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'business' | 'walk_in')}>
          <option value="business">Business (GST / invoices)</option>
          <option value="walk_in">Walk-in / individual</option>
        </select>
      </Field>
      <button
        className="btn primary"
        disabled={!name.trim() || bad}
        onClick={() =>
          onSave({
            name: name.trim(),
            phone: phone.trim() || undefined,
            kind,
            tone: kind === 'business' ? 'formal' : 'friendly',
            applyLegal: false,
            language: 'en',
            optedOut: false
          })
        }
      >
        Save
      </button>
    </Modal>
  );
}

type Dialog = null | { t: 'pay' | 'promise'; invoiceId: string } | { t: 'invoice' } | { t: 'log' };

export function CustomerDetail({ id }: { id: string }) {
  const { snap, views, today, saveCustomer, addPayment, addPromise, addEvent, addInvoice } = useApp();
  const c = snap.customers.find((x) => x.id === id);
  const [dlg, setDlg] = useState<Dialog>(null);
  if (!c)
    return (
      <Empty>
        Customer not found. <a href="#/customers">Back</a>
      </Empty>
    );

  const mine = views
    .filter((v) => v.customer.id === id)
    .sort((a, b) => b.invoice.issueDate.localeCompare(a.invoice.issueDate));
  const open = mine.filter((v) => v.stage !== 'paid');
  const legalOn = legalApplies(snap.business, c);

  const timeline = [
    ...snap.reminders
      .filter((r) => r.customerId === id)
      .map((r) => ({
        at: r.sentAt,
        icon: r.status === 'sent' ? '→' : '–',
        text: r.status === 'sent' ? `${stepLabel(r.step)} sent by ${r.channel}` : `${stepLabel(r.step)} skipped`,
        body: r.status === 'sent' ? r.body : ''
      })),
    ...snap.events
      .filter((e) => e.customerId === id)
      .map((e) => ({
        at: e.at,
        icon: e.kind === 'call' ? '☎' : e.kind === 'reply' ? '←' : '✎',
        text: e.kind === 'call' ? 'Call' : e.kind === 'reply' ? 'Customer replied' : 'Note',
        body: e.body
      })),
    ...snap.payments
      .filter((p) => mine.some((v) => v.invoice.id === p.invoiceId))
      .map((p) => ({
        at: p.paidOn + 'T12:00:00Z',
        icon: '₹',
        text: `Payment received${p.method ? ' (' + p.method + ')' : ''}`,
        body: `${p.amount.toLocaleString('en-IN')} on ${formatDate(p.paidOn)}`
      }))
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section>
      <p>
        <a href="#/customers" className="back">
          ← Customers
        </a>
      </p>
      <h1>{c.name}</h1>
      <div className="row wrap">
        {c.optedOut && <Pill tone="red">Opted out</Pill>}
        {legalOn && <Pill tone="navy">Legal wording on</Pill>}
        <Pill tone="grey">{c.tone === 'formal' ? 'Formal' : 'Friendly'}</Pill>
        <Pill tone="grey">{c.language === 'hinglish' ? 'Hinglish' : 'English'}</Pill>
        {open.length > 0 && legalOn && (
          <a className="btn" href={`#/statement/${id}`}>
            Statement with interest
          </a>
        )}
        <button className="btn" onClick={() => setDlg({ t: 'invoice' })}>
          Add invoice
        </button>
        <button className="btn" onClick={() => setDlg({ t: 'log' })}>
          Log a reply / call
        </button>
      </div>

      <h2>Invoices</h2>
      {mine.length === 0 ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <div className="card list">
          {mine.map((v) => (
            <div key={v.invoice.id} className="line col">
              <div className="between">
                <div>
                  <strong className="mono">#{v.invoice.number}</strong>{' '}
                  <span className="sub">
                    {formatShort(v.invoice.issueDate)} · {v.invoice.agreedDays}d terms
                  </span>
                </div>
                <div>{stagePill(v.stage, v.daysOverdue)}</div>
              </div>
              <div className="between">
                <span className="sub">
                  Billed <Money v={v.invoice.amount} />
                  {v.paid > 0 && (
                    <>
                      {' '}
                      · paid <Money v={v.paid} />
                    </>
                  )}
                </span>
                <strong>
                  <Money v={v.balance} />
                </strong>
              </div>
              {v.legalOn && v.stage !== 'paid' && (
                <div className="sub">
                  {v.daysToLegal >= 0
                    ? `Legal limit in ${v.daysToLegal} days (${formatShort(v.legalDue)})`
                    : `Past legal limit by ${-v.daysToLegal} days · interest on paper `}
                  {v.daysToLegal < 0 && <Money v={v.interest} dec />}
                </div>
              )}
              {v.activePromise && (
                <div className="sub">
                  Promised {formatShort(v.activePromise.promisedOn)}
                  {v.activePromise.note ? ` · ${v.activePromise.note}` : ''}
                </div>
              )}
              {v.brokenPromise && (
                <div className="warn">Promise for {formatShort(v.brokenPromise.promisedOn)} was missed</div>
              )}
              {v.stage !== 'paid' && (
                <div className="row">
                  <button className="btn" onClick={() => setDlg({ t: 'pay', invoiceId: v.invoice.id })}>
                    Record payment
                  </button>
                  <button className="btn ghost" onClick={() => setDlg({ t: 'promise', invoiceId: v.invoice.id })}>
                    They promised a date
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2>Contact and rules</h2>
      <CustomerForm
        key={c.id + JSON.stringify(c)}
        c={c}
        legalAllowed={snap.business.udyamStatus.startsWith('registered')}
        onSave={(p) => saveCustomer(id, p)}
      />

      <h2>History</h2>
      {timeline.length === 0 ? (
        <Empty>Nothing yet.</Empty>
      ) : (
        <div className="card timeline">
          {timeline.map((e, i) => (
            <div key={i} className="ev">
              <span className="ic">{e.icon}</span>
              <div>
                <strong>{e.text}</strong>{' '}
                <span className="sub">{e.at.slice(0, 10) === today ? 'today' : formatShort(e.at.slice(0, 10))}</span>
                {e.body && <pre>{e.body}</pre>}
              </div>
            </div>
          ))}
        </div>
      )}

      {dlg?.t === 'pay' && (
        <PayDialog
          invoiceId={dlg.invoiceId}
          onClose={() => setDlg(null)}
          onSave={async (a, d, m) => {
            await addPayment(dlg.invoiceId, a, d, m);
            setDlg(null);
          }}
        />
      )}
      {dlg?.t === 'promise' && (
        <PromiseDialog
          onClose={() => setDlg(null)}
          onSave={async (d, n) => {
            await addPromise(dlg.invoiceId, d, n);
            setDlg(null);
          }}
        />
      )}
      {dlg?.t === 'log' && (
        <LogDialog
          onClose={() => setDlg(null)}
          onSave={async (k, b) => {
            await addEvent(id, k, b);
            setDlg(null);
          }}
        />
      )}
      {dlg?.t === 'invoice' && (
        <InvoiceDialog
          onClose={() => setDlg(null)}
          onSave={async (inv) => {
            await addInvoice({ ...inv, customerId: id });
            setDlg(null);
          }}
          today={today}
        />
      )}
    </section>
  );
}

function CustomerForm({
  c,
  legalAllowed,
  onSave
}: {
  c: Customer;
  legalAllowed: boolean;
  onSave(p: Partial<Omit<Customer, 'id'>>): void;
}) {
  const [f, setF] = useState(c);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setF((p) => ({ ...p, [k]: v }));
  const badMain = !!f.phone && !normalizePhone(f.phone).valid;
  const badAcc = !!f.accountsPhone && !normalizePhone(f.accountsPhone).valid;
  const dirty = JSON.stringify(f) !== JSON.stringify(c);
  return (
    <div className="card form">
      <Field label="Name">
        <input value={f.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Contact person">
        <input value={f.contactPerson ?? ''} onChange={(e) => set('contactPerson', e.target.value)} />
      </Field>
      <Field label="WhatsApp number" hint={badMain ? 'Does not look valid' : undefined}>
        <input value={f.phone ?? ''} inputMode="tel" onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field
        label="Accounts desk number"
        hint={badAcc ? 'Does not look valid' : 'Optional. Firm and legal messages go here if set.'}
      >
        <input value={f.accountsPhone ?? ''} inputMode="tel" onChange={(e) => set('accountsPhone', e.target.value)} />
      </Field>
      <div className="two">
        <Field label="Type">
          <select value={f.kind} onChange={(e) => set('kind', e.target.value as Customer['kind'])}>
            <option value="business">Business</option>
            <option value="walk_in">Walk-in / individual</option>
          </select>
        </Field>
        <Field label="Tone">
          <select value={f.tone} onChange={(e) => set('tone', e.target.value as Customer['tone'])}>
            <option value="formal">Formal</option>
            <option value="friendly">Friendly</option>
          </select>
        </Field>
        <Field label="Language">
          <select value={f.language} onChange={(e) => set('language', e.target.value as Customer['language'])}>
            <option value="en">English</option>
            <option value="hinglish">Hinglish</option>
          </select>
        </Field>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={f.applyLegal}
          disabled={!legalAllowed || f.kind !== 'business'}
          onChange={(e) => set('applyLegal', e.target.checked)}
        />
        <span>
          Mention the MSME payment law with this customer
          <small>
            {legalAllowed
              ? 'Only for business customers. You decide per customer. Confirm with your CA first.'
              : 'Set your Udyam status to registered in Settings to use this.'}
          </small>
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={f.optedOut} onChange={(e) => set('optedOut', e.target.checked)} />
        <span>
          Asked us to stop reminders
          <small>No messages are queued for them. They stay on the "needs a person" list.</small>
        </span>
      </label>
      <Field label="Notes">
        <textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <button
        className="btn primary"
        disabled={!dirty || !f.name.trim() || badMain || badAcc}
        onClick={() =>
          onSave({
            name: f.name.trim(),
            contactPerson: f.contactPerson,
            phone: f.phone,
            accountsPhone: f.accountsPhone,
            kind: f.kind,
            tone: f.tone,
            language: f.language,
            applyLegal: f.kind === 'business' && f.applyLegal,
            optedOut: f.optedOut,
            notes: f.notes
          })
        }
      >
        Save changes
      </button>
    </div>
  );
}

function PayDialog({
  invoiceId,
  onClose,
  onSave
}: {
  invoiceId: string;
  onClose(): void;
  onSave(a: number, d: string, m?: string): void;
}) {
  const { views, today } = useApp();
  const v = views.find((x) => x.invoice.id === invoiceId)!;
  const [amt, setAmt] = useState(String(v.balance));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState('UPI');
  const n = Number(amt);
  const err = !(n > 0)
    ? 'Enter an amount'
    : n > v.balance + 0.005
      ? 'More than the balance'
      : date > today
        ? 'Date is in the future'
        : '';
  return (
    <Modal title={`Payment on #${v.invoice.number}`} onClose={onClose}>
      <p className="sub">
        Balance <Money v={v.balance} dec />
      </p>
      <Field label="Amount received" hint={err || undefined}>
        <input autoFocus inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <Field label="Date">
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="How">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {['UPI', 'Bank transfer', 'Cheque', 'Cash', 'Other'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <button className="btn primary" disabled={!!err} onClick={() => onSave(n, date, method)}>
        Save payment
      </button>
    </Modal>
  );
}

function PromiseDialog({ onClose, onSave }: { onClose(): void; onSave(d: string, n?: string): void }) {
  const { today } = useApp();
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  return (
    <Modal title="Promised date" onClose={onClose}>
      <p className="sub">
        Reminders for this invoice pause until that day. If it is still unpaid after, you get a follow-up message.
      </p>
      <Field label="They said they will pay on">
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after stock sale" />
      </Field>
      <button
        className="btn primary"
        disabled={!date || date < today}
        onClick={() => onSave(date, note.trim() || undefined)}
      >
        Save promise
      </button>
    </Modal>
  );
}

function LogDialog({ onClose, onSave }: { onClose(): void; onSave(k: 'reply' | 'call' | 'note', b: string): void }) {
  const [kind, setKind] = useState<'reply' | 'call' | 'note'>('reply');
  const [body, setBody] = useState('');
  return (
    <Modal title="Log what happened" onClose={onClose}>
      <Field label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'reply' | 'call' | 'note')}>
          <option value="reply">They replied</option>
          <option value="call">I called them</option>
          <option value="note">Note</option>
        </select>
      </Field>
      <Field label="What was said">
        <textarea autoFocus rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <button className="btn primary" disabled={!body.trim()} onClick={() => onSave(kind, body.trim())}>
        Save
      </button>
    </Modal>
  );
}

function InvoiceDialog({
  onClose,
  onSave,
  today
}: {
  onClose(): void;
  onSave(i: {
    customerId: string;
    number: string;
    issueDate: string;
    agreedDays: number;
    writtenAgreement: boolean;
    amount: number;
  }): void;
  today: string;
}) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('30');
  const [written, setWritten] = useState(false);
  const a = Number(amount);
  const d = Number(days);
  return (
    <Modal title="Add invoice" onClose={onClose}>
      <Field label="Invoice number">
        <input autoFocus value={number} onChange={(e) => setNumber(e.target.value)} />
      </Field>
      <Field label="Invoice date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Amount (₹)">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Payment terms (days)" hint="0 means due on the invoice date">
        <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} />
        <span>
          Terms are agreed in writing
          <small>Affects the legal limit: 45 days with a written agreement, 15 days without.</small>
        </span>
      </label>
      <button
        className="btn primary"
        disabled={!number.trim() || !(a > 0) || !Number.isInteger(d) || d < 0 || d > 365 || !date}
        onClick={() =>
          onSave({
            customerId: '',
            number: number.trim(),
            issueDate: date,
            amount: a,
            agreedDays: d,
            writtenAgreement: written
          })
        }
      >
        Save invoice
      </button>
    </Modal>
  );
}
