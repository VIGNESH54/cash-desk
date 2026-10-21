import { buildBrief } from '../core/brief';
import { whatsappLink, normalizePhone } from '../core/phone';
import { formatDate } from '../core/dates';
import { CopyButton, Money } from './ui';
import { useApp } from './Store';

export default function BriefPage() {
  const { snap, today } = useApp();
  const b = buildBrief(snap, today);
  const owner = normalizePhone(snap.business.ownerPhone);
  return (
    <section>
      <h1>
        Cash brief <small>{formatDate(today)}</small>
      </h1>
      <p className="lede">A short end-of-day summary you can send to yourself or a partner on WhatsApp.</p>
      <div className="stats">
        <div className="stat">
          <span>Received today</span>
          <strong>
            <Money v={b.receivedToday} />
          </strong>
          <small>{b.receivedCount} payments</small>
        </div>
        <div className="stat">
          <span>Overdue</span>
          <strong>
            <Money v={b.overdue} />
          </strong>
        </div>
        <div className="stat">
          <span>Messages tomorrow</span>
          <strong>{b.queueTomorrow}</strong>
        </div>
      </div>
      <pre className="card brief">{b.text}</pre>
      <div className="row wrap">
        <CopyButton text={b.text} label="Copy brief" />
        {owner.valid ? (
          <a className="btn primary" target="_blank" rel="noreferrer" href={whatsappLink(owner.digits, b.text)}>
            Send to my WhatsApp
          </a>
        ) : (
          <a className="btn" href="#/settings">
            Add your number in Settings to send this to yourself
          </a>
        )}
      </div>
    </section>
  );
}
