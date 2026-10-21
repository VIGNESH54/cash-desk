import { buildStatement } from '../core/statement';
import { formatDate } from '../core/dates';
import { formatINR } from '../core/money';
import { Empty } from './ui';
import { useApp } from './Store';

export default function StatementPage({ id }: { id: string }) {
  const { snap, views, today } = useApp();
  const c = snap.customers.find((x) => x.id === id);
  if (!c) return <Empty>Customer not found.</Empty>;
  const s = buildStatement(snap.business, c, views, today);
  return (
    <section className="statement">
      <div className="no-print row">
        <a href={`#/customers/${id}`} className="back">
          ← Back
        </a>
        <button className="btn primary" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>
      <h1>Statement of dues</h1>
      <p>
        <strong>{s.business.name}</strong> to <strong>{c.name}</strong>
        <br />
        As of {formatDate(s.asOf)}
      </p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Statement table">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Accepted</th>
              <th>Legal due</th>
              <th className="r">Days late</th>
              <th className="r">Principal</th>
              <th className="r">Interest</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.number}>
                <td className="mono">{r.number}</td>
                <td>{formatDate(r.acceptedOn)}</td>
                <td>{formatDate(r.legalDue)}</td>
                <td className="r">{r.daysLate > 0 ? r.daysLate : '–'}</td>
                <td className="r mono">{formatINR(r.principal)}</td>
                <td className="r mono">{r.interest > 0 ? formatINR(r.interest, { decimals: true }) : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="r mono">{formatINR(s.principal)}</td>
              <td className="r mono">{formatINR(s.interest, { decimals: true })}</td>
            </tr>
            <tr>
              <td colSpan={5}>
                <strong>Principal + interest claimed</strong>
              </td>
              <td className="r mono">
                <strong>{formatINR(s.total, { decimals: true })}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="sub">
        Interest at {s.annualRatePct.toFixed(2)}% a year (3 × RBI bank rate {s.bankRate}%), compounded monthly, from the
        legal due date.
      </p>
      <ul className="sub">
        {s.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
