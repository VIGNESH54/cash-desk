import { useState } from 'react';
import { attention, type QueueItem } from '../core/planner';
import { formatDate, weekdayName } from '../core/dates';
import { smsLink, whatsappLink } from '../core/phone';
import { Money, Pill, CopyButton, Empty, Modal, Field } from './ui';
import { useApp } from './Store';
import { go } from './router';

function QueueCard({ item }: { item: QueueItem }) {
  const { markSent, skip, saveCustomer, busy } = useApp();
  const [body, setBody] = useState(item.body);
  const [opened, setOpened] = useState(false);
  const [phoneAsk, setPhoneAsk] = useState(false);
  const [phone, setPhone] = useState('');
  const tone = item.level === 'legal' ? 'red' : item.level === 'firm' ? 'amber' : 'grey';

  return (
    <article className="card queue">
      <header>
        <div>
          <a className="name" href={`#/customers/${item.customer.id}`}>
            {item.customer.name}
          </a>
          <div className="sub">
            {item.views.length} invoice{item.views.length > 1 ? 's' : ''} · <Money v={item.totalBalance} /> · to{' '}
            {item.toKind === 'accounts' ? 'accounts desk' : item.customer.contactPerson || 'main contact'}
          </div>
        </div>
        <Pill tone={tone}>{item.label}</Pill>
      </header>

      <textarea
        className="msg"
        value={body}
        rows={Math.min(14, body.split('\n').length + 1)}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Message text"
      />

      {!item.phoneValid ? (
        <div className="row">
          <span className="warn">No valid phone number on file.</span>
          <button className="btn" onClick={() => setPhoneAsk(true)}>
            Add number
          </button>
          <CopyButton text={body} />
          <button className="btn ghost" onClick={() => skip(item)}>
            Skip today
          </button>
        </div>
      ) : !opened ? (
        <div className="row">
          <a
            className="btn primary"
            href={whatsappLink(item.to, body)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpened(true)}
          >
            Open WhatsApp
          </a>
          <a className="btn" href={smsLink(item.to, body)} onClick={() => setOpened(true)}>
            SMS
          </a>
          <CopyButton text={body} />
          <button className="btn ghost" disabled={busy} onClick={() => skip(item)}>
            Skip today
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => markSent(item, body, 'whatsapp')}>
            I sent it
          </button>
          <button className="btn" disabled={busy} onClick={() => markSent(item, body, 'sms')}>
            Sent by SMS
          </button>
          <button className="btn ghost" onClick={() => setOpened(false)}>
            Didn't send
          </button>
        </div>
      )}

      {phoneAsk && (
        <Modal title={`Phone for ${item.customer.name}`} onClose={() => setPhoneAsk(false)}>
          <Field label="WhatsApp number" hint="10-digit Indian number, or +country code for abroad">
            <input autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <button
            className="btn primary"
            disabled={!phone.trim()}
            onClick={async () => {
              await saveCustomer(item.customer.id, { phone: phone.trim() });
              setPhoneAsk(false);
            }}
          >
            Save number
          </button>
        </Modal>
      )}
    </article>
  );
}

function Coach() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('cashdesk.coach') !== 'done';
    } catch {
      return true;
    }
  });
  if (!open) return null;
  return (
    <aside className="coach" aria-label="How this screen works">
      <strong>How this screen works</strong>
      <ol>
        <li>Each card is a message ready for one customer. Read it, and edit it if you like.</li>
        <li>Tap Open WhatsApp. The chat opens with the message filled in. Send it there.</li>
        <li>Come back and tap I sent it. The customer leaves today's list and the history is saved.</li>
      </ol>
      <button
        className="btn"
        onClick={() => {
          try {
            localStorage.setItem('cashdesk.coach', 'done');
          } catch {
            /* ignore */
          }
          setOpen(false);
        }}
      >
        Got it
      </button>
    </aside>
  );
}

export default function Today() {
  const { queue, snap, today } = useApp();
  const needs = attention(snap, today);
  const done = snap.reminders.filter((r) => r.plannedFor === today).length;

  return (
    <section>
      <h1>
        Today{' '}
        <small>
          {weekdayName(today)}, {formatDate(today)}
        </small>
      </h1>
      <Coach />
      {queue.length === 0 ? (
        <Empty>
          <strong>Nothing to send today.</strong>
          <p>
            {done > 0
              ? `You handled ${done} message${done > 1 ? 's' : ''} already.`
              : 'No invoice needs a reminder right now.'}
          </p>
          <button className="btn" onClick={() => go('/money')}>
            See the money screen
          </button>
        </Empty>
      ) : (
        <>
          <p className="lede">
            {queue.length} message{queue.length > 1 ? 's' : ''} ready, most urgent first. Read each one, edit if you
            like, then send.
          </p>
          {queue.map((q) => (
            <QueueCard key={q.key + q.plannedFor} item={q} />
          ))}
        </>
      )}

      {needs.length > 0 && (
        <>
          <h2>Needs a person, not a message</h2>
          <div className="card list">
            {needs.map((a) => (
              <a key={a.customerId + a.kind} className="line" href={`#/customers/${a.customerId}`}>
                <div>
                  <strong>{a.customerName}</strong>
                  <div className="sub">{a.detail}</div>
                </div>
                <Money v={a.amount} />
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
