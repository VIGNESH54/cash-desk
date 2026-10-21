import { useState } from 'react';
import { BUCKETS, totals } from '../core/ledger';
import { formatDate, formatShort } from '../core/dates';
import { formatINR, formatINRShort } from '../core/money';
import { Money as Rs, Pill, stagePill, Empty } from './ui';
import { useApp } from './Store';

const BUCKET_LABEL: Record<string, string> = {
  current: 'Not due',
  '1-30': '1–30 days',
  '31-60': '31–60',
  '61-90': '61–90',
  '90+': '90+'
};

export default function MoneyPage() {
  const { views, snap } = useApp();
  const t = totals(views);
  const [filter, setFilter] = useState<'open' | 'overdue' | 'all'>('open');
  const max = Math.max(1, ...BUCKETS.map((b) => t.byBucket[b]));
  const crossing = views
    .filter((v) => v.legalOn && v.stage !== 'paid' && v.daysToLegal >= 0 && v.daysToLegal <= 10)
    .sort((a, b) => a.daysToLegal - b.daysToLegal);
  const promises = views
    .filter((v) => v.activePromise)
    .sort((a, b) => a.activePromise!.promisedOn.localeCompare(b.activePromise!.promisedOn));
  const rows = views
    .filter((v) => (filter === 'all' ? true : filter === 'open' ? v.stage !== 'paid' : v.stage === 'overdue'))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return (
    <section>
      <h1>Money</h1>
      <div className="stats">
        <div className="stat">
          <span>Outstanding</span>
          <strong>
            <Rs v={t.outstanding} />
          </strong>
          <small>{t.invoicesOpen} open invoices</small>
        </div>
        <div className="stat red">
          <span>Overdue</span>
          <strong>
            <Rs v={t.overdue} />
          </strong>
          <small>{t.invoicesOverdue} invoices</small>
        </div>
        <div className="stat">
          <span>Past the legal limit</span>
          <strong>
            <Rs v={t.pastLegalAmount} />
          </strong>
          <small>{t.pastLegalCount} invoices</small>
        </div>
        <div className="stat">
          <span>Interest on paper</span>
          <strong>
            <Rs v={t.interestOnPaper} />
          </strong>
          <small>not collected, a claim only</small>
        </div>
      </div>

      <h2>How old is the money</h2>
      <div className="card ageing" role="img" aria-label="Outstanding by age">
        {BUCKETS.map((b) => (
          <div key={b} className="bar">
            <div className="fill" style={{ height: `${Math.max(2, (t.byBucket[b] / max) * 100)}%` }} data-b={b} />
            <strong>{formatINRShort(t.byBucket[b])}</strong>
            <span>{BUCKET_LABEL[b]}</span>
          </div>
        ))}
      </div>

      {crossing.length > 0 && (
        <>
          <h2>About to cross the legal limit</h2>
          <div className="card list">
            {crossing.map((v) => (
              <a key={v.invoice.id} className="line" href={`#/customers/${v.customer.id}`}>
                <div>
                  <strong>{v.customer.name}</strong> <span className="sub">#{v.invoice.number}</span>
                  <div className="sub">
                    {v.daysToLegal === 0 ? 'Limit is today' : `${v.daysToLegal} days left`} · {formatDate(v.legalDue)}
                  </div>
                </div>
                <Rs v={v.balance} />
              </a>
            ))}
          </div>
        </>
      )}

      {promises.length > 0 && (
        <>
          <h2>Promised payments</h2>
          <div className="card list">
            {promises.map((v) => (
              <a key={v.invoice.id} className="line" href={`#/customers/${v.customer.id}`}>
                <div>
                  <strong>{v.customer.name}</strong> <span className="sub">#{v.invoice.number}</span>
                  <div className="sub">
                    Promised {formatShort(v.activePromise!.promisedOn)}
                    {v.activePromise!.note ? ` · ${v.activePromise!.note}` : ''}
                  </div>
                </div>
                <Rs v={v.balance} />
              </a>
            ))}
          </div>
        </>
      )}

      <h2>Invoices</h2>
      <div className="tabs small">
        {(['open', 'overdue', 'all'] as const).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'open' ? 'Open' : f === 'overdue' ? 'Overdue' : 'All'}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>No invoices here.</Empty>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Due</th>
                <th className="r">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.invoice.id} onClick={() => (window.location.hash = `#/customers/${v.customer.id}`)}>
                  <td>{v.customer.name}</td>
                  <td className="mono">{v.invoice.number}</td>
                  <td>{formatShort(v.agreedDue)}</td>
                  <td className="r mono">{formatINR(v.balance)}</td>
                  <td>
                    {stagePill(v.stage, v.daysOverdue)}
                    {v.legalOn && v.stage !== 'paid' && v.daysToLegal < 0 && (
                      <>
                        {' '}
                        <Pill tone="red">past limit</Pill>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="foot">{snap.customers.length} customers · figures as of the date shown on Today.</p>
    </section>
  );
}
