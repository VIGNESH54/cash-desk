import { useMemo, useState } from 'react';
import { SITE } from '../config';
import { addDays } from '../core/dates';
import { statutoryInterest } from '../core/legal';
import { formatINR } from '../core/money';
import { whatsappLink } from '../core/phone';

/** Hash routing owns the URL, so in-page links scroll instead of changing it. */
const jump = (id: string) =>
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start'
  });
function Jump({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      className={className}
      href={`#/${to}`}
      onClick={(e) => {
        e.preventDefault();
        jump(to);
      }}
    >
      {children}
    </a>
  );
}

interface Props {
  /** true when a demo or account is already open, so the page can offer a way back in */
  hasApp: boolean;
  onDemo(): void;
  onOpenApp(): void;
}

const ROWS = [
  {
    name: 'Patel Engineering Works',
    inv: 'INV-2150',
    due: '6 Sep',
    amt: '2,00,000',
    late: '45 days late',
    tone: 'bad'
  },
  { name: 'Gupta Enterprises', inv: 'INV-2090', due: '11 Sep', amt: '2,10,000', late: '40 days late', tone: 'bad' },
  {
    name: 'Sharma Auto Components',
    inv: 'INV-2207',
    due: '25 Oct',
    amt: '4,80,000',
    late: 'limit in 4 days',
    tone: 'mark'
  },
  { name: 'Singh Traders', inv: 'INV-2101', due: '26 Sep', amt: '68,000', late: '25 days late', tone: 'warn' },
  { name: 'Kumar Stores', inv: 'INV-2189', due: '12 Oct', amt: '32,000', late: '9 days late', tone: 'warn' }
] as const;

function Header({ hasApp, onDemo, onOpenApp }: Props) {
  return (
    <header className="s-nav">
      <a className="s-brand" href="#/" aria-label="Cash Desk home">
        <span className="s-brand-mark" aria-hidden="true" />
        Cash Desk
      </a>
      <nav aria-label="Page sections">
        <Jump to="how">How it works</Jump>
        <Jump to="ladder">The reminders</Jump>
        <Jump to="law">The law</Jump>
        <Jump to="faq">Questions</Jump>
      </nav>
      <div className="s-nav-cta">
        <a className="s-link" href="#/signin">
          Sign in
        </a>
        <button className="s-btn s-btn-solid" onClick={hasApp ? onOpenApp : onDemo}>
          {hasApp ? 'Back to the demo' : 'Try the demo'}
        </button>
      </div>
    </header>
  );
}

function Hero({ onDemo }: Props) {
  return (
    <section className="s-hero">
      <div className="s-hero-copy">
        <h1>
          Chasing payments is a job.
          <br />
          Cash Desk does the writing.
        </h1>
        <p className="s-lede">
          Every morning it lists the customers to remind, with the message already written for each one. You read it,
          tap send on WhatsApp, and it keeps the record. It also warns you before a bill crosses the 45-day legal limit.
        </p>
        <div className="s-actions">
          <button className="s-btn s-btn-solid s-btn-big" onClick={onDemo}>
            Try the demo
          </button>
          <Jump className="s-btn s-btn-line s-btn-big" to="how">
            See how a day works
          </Jump>
        </div>
        <p className="s-fine">No sign-up. Sample customers. Nothing is sent unless you tap send.</p>
      </div>

      <figure
        className="s-ledger"
        aria-label="A sample receivables ledger with one bill about to cross the legal limit"
      >
        <div className="s-ledger-head">
          <strong>Demo Fasteners Pvt Ltd</strong>
          <span>Unpaid bills, 21 Oct</span>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col" className="r">
                Balance
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.inv} className={`t-${r.tone}`}>
                <td>
                  {r.name}
                  <small>
                    {r.inv}, due {r.due}
                  </small>
                </td>
                <td className="r fig">₹{r.amt}</td>
                <td>{r.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="s-stamp" aria-hidden="true">
          Reminder
          <br />
          ready
        </div>
        <figcaption className="s-bubble">
          <span>Message for Sharma Auto Components</span>
          Invoice INV-2207 for ₹4,80,000 reaches its 45-day legal payment limit on 25 Oct (in 4 days). After that date
          interest can accrue under the MSMED Act. Please confirm the payment date.
          <em>Open WhatsApp</em>
        </figcaption>
      </figure>
    </section>
  );
}

function Stuck() {
  return (
    <section className="s-stuck">
      <p>
        Most small suppliers know exactly who owes them. What they do not have is the time, or the nerve, to ask the
        same customer for the same money every week without souring the relationship.
      </p>
      <p>
        So the polite first reminder goes out late, the firm one never goes out, and a bill that was 30 days overdue
        turns into one that is 90 days overdue. Cash Desk makes the asking routine: right message, right day, right
        tone, and a record of what was said.
      </p>
    </section>
  );
}

const STEPS = [
  {
    title: 'Bring your unpaid bills',
    body: 'Upload the pending-bills export from Tally, Busy or Vyapar, or any Excel sheet saved as CSV. Columns are matched for you and you see a preview before anything is saved.',
    art: (
      <div className="art art-import">
        <div>Customer, Invoice No, Date, Pending</div>
        <div>Sharma Auto, INV-2207, 11 Sep, 4,80,000</div>
        <div>Patel Eng., INV-2150, 07 Aug, 2,00,000</div>
        <b>2 invoices ready to import</b>
      </div>
    )
  },
  {
    title: 'Read today’s list',
    body: 'Each morning you get only the customers who need a message today, most urgent first. A customer with a promised payment date is left alone until that day.',
    art: (
      <div className="art art-list">
        <div>
          <b>Patel Engineering</b> <i>Interest statement</i>
        </div>
        <div>
          <b>Sharma Auto</b> <i>Legal limit heads-up</i>
        </div>
        <div>
          <b>Gupta Enterprises</b> <i>Weekly follow-up</i>
        </div>
      </div>
    )
  },
  {
    title: 'Edit if you like, then tap send',
    body: 'The message opens in your own WhatsApp, with your number, so the customer sees it from you. Change a word if you want. Nothing leaves without your tap.',
    art: (
      <div className="art art-send">
        <div>Hello Mr. Gupta, a follow-up from Demo Fasteners: invoice INV-2090 for ₹2,10,000 is still unpaid.</div>
        <b>Open WhatsApp</b>
      </div>
    )
  },
  {
    title: 'It keeps the record',
    body: 'Mark payments, log what the customer said, note a promised date. Everything sits on one history per customer, and the next reminder takes it into account.',
    art: (
      <div className="art art-record">
        <div>
          <i>15 Sep</i> Gentle nudge sent
        </div>
        <div>
          <i>19 Sep</i> Message to accounts team
        </div>
        <div>
          <i>25 Sep</i> Said: will pay Friday
        </div>
      </div>
    )
  }
];

function How() {
  return (
    <section className="s-how" id="how">
      <h2>One morning, four steps</h2>
      <ol>
        {STEPS.map((s) => (
          <li key={s.title}>
            <div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
            {s.art}
          </li>
        ))}
      </ol>
    </section>
  );
}

const LADDER = [
  { day: 'Due date', tone: 'Friendly', text: 'A short reminder that the invoice is due today.' },
  { day: 'Day 4', tone: 'Friendly', text: 'A gentle nudge: could you confirm when we can expect payment?' },
  {
    day: 'Day 7',
    tone: 'To accounts',
    text: 'The same request, sent to the accounts team’s number instead of the person you deal with.'
  },
  { day: 'Day 14', tone: 'Firm', text: 'Please arrange payment this week, or call us if there is a problem.' },
  {
    day: 'Day 40',
    tone: 'Legal heads-up',
    text: 'A warning that the 45-day limit is a few days away, and what changes after it. Only for customers you switch this on for.'
  },
  {
    day: 'Past the limit',
    tone: 'Interest statement',
    text: 'A statement of dues with the interest worked out, ready to review and send.'
  }
];

function Ladder() {
  return (
    <section className="s-ladder" id="ladder">
      <div className="s-sec-head">
        <h2>The reminders get firmer on a schedule, not on a mood</h2>
        <p>
          This is the path of one bill from a formal business customer. Friendly customers and walk-in buyers get a
          softer, shorter path. Every step is a message you read before it goes.
        </p>
      </div>
      <ol className="s-line">
        {LADDER.map((l) => (
          <li key={l.day}>
            <span className="d">{l.day}</span>
            <div>
              <strong>{l.tone}</strong>
              <p>{l.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="s-note">
        Also built in: one message per customer per day, no messages on Sundays, a pause when a customer has promised a
        date, and a first message that is never harsher than “firm”, even for an old bill you import late.
      </p>
    </section>
  );
}

function Law() {
  const [amount, setAmount] = useState(480000);
  const [late, setLate] = useState(30);
  const [rate, setRate] = useState(5.75);
  const r = useMemo(
    () => statutoryInterest(amount, '2026-01-01', addDays('2026-01-01', late), rate),
    [amount, late, rate]
  );

  return (
    <section className="s-law" id="law">
      <div className="s-law-copy">
        <h2>The law is on the supplier’s side. Most never use it.</h2>
        <p>
          For micro and small suppliers, the MSMED Act says a buyer must pay within the agreed time, and never later
          than 45 days after accepting the goods if there is a written agreement (15 days if there is not). Late payment
          carries interest at three times the RBI bank rate, compounded monthly.
        </p>
        <p>
          Section 43B(h) of the Income-tax Act adds a second push: a buyer can claim the tax deduction for a late-paid
          micro or small supplier bill only in the year they actually pay it.
        </p>
        <p className="s-fine">
          This is a general summary, not legal advice. Whether it applies to you depends on your registration and your
          customer. Check with your CA before you rely on it.
        </p>
      </div>

      <div className="s-calc" role="group" aria-label="Late payment interest calculator">
        <h3>What a late bill adds up to</h3>
        <label>
          <span>Bill amount</span>
          <output>{formatINR(amount)}</output>
          <input
            type="range"
            min={10000}
            max={5000000}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Days past the legal limit</span>
          <output>{late}</output>
          <input
            type="range"
            min={0}
            max={365}
            step={5}
            value={late}
            onChange={(e) => setLate(Number(e.target.value))}
          />
        </label>
        <label>
          <span>RBI bank rate, percent</span>
          <output>{rate.toFixed(2)}</output>
          <input
            type="range"
            min={3}
            max={10}
            step={0.25}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <div className="s-result">
          <div>
            <span>Interest on paper</span>
            <strong className="fig">{formatINR(r.interest, { decimals: true })}</strong>
          </div>
          <div>
            <span>Bill plus interest</span>
            <strong className="fig">{formatINR(amount + r.interest, { decimals: true })}</strong>
          </div>
        </div>
        <p className="s-fine">
          Yearly rate {r.annualRatePct.toFixed(2)}% (3 × {rate.toFixed(2)}%), compounded monthly. An illustration with a
          rate you can change: check today’s RBI rate. The interest is a claim, not money you are owed until the
          customer agrees or a forum decides.
        </p>
      </div>
    </section>
  );
}

const CONTROL: [string, string][] = [
  ['Nothing sends by itself', 'Each message opens in your WhatsApp. You tap send, then confirm that you sent it.'],
  [
    'Legal wording is off until you switch it on',
    'Per customer, and only if your Udyam status is registered micro or small and the customer is a business.'
  ],
  [
    'Opt-out is respected',
    'Mark a customer as “asked us to stop” and they never appear in your list again. They move to a list of people to call.'
  ],
  [
    'You see what is not working',
    'Missing phone numbers and customers who stay silent after repeated reminders are listed separately, because software cannot fix those.'
  ],
  [
    'Your data stays yours',
    'Each business’s records are separated at the database level. You can download everything as a file at any time.'
  ]
];

function Control() {
  return (
    <section className="s-control">
      <h2>You stay in charge of every message</h2>
      <dl>
        {CONTROL.map(([t, d]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const FAQ: [string, string][] = [
  [
    'Does it send WhatsApp messages automatically?',
    'No. Today each message opens in your own WhatsApp and you tap send. Automatic sending needs WhatsApp Business approval, and it is a later step.'
  ],
  [
    'Is this legal advice?',
    'No. The legal wording and interest figures follow public summaries of the MSMED Act and Section 43B(h). Whether they apply to you depends on your registration and your customer, so check with your CA.'
  ],
  [
    'Will it work with my accounting software?',
    'You import a pending-bills export as CSV from Tally, Busy, Vyapar or Excel. There is no live sync yet, so re-import when you add many new bills.'
  ],
  [
    'What if a customer replies or calls?',
    'Log it on their page: a reply, a call, or a promised date. Reminders for that bill pause until the date, then a follow-up comes up if it is still unpaid.'
  ],
  [
    'Where is my data kept?',
    'In your account on a managed database in the Mumbai region. The demo keeps its sample data only in your browser.'
  ],
  [
    'What should I try first?',
    'Open the demo, send one message, record a payment, then move the demo forward a week in Settings to see how the reminders change.'
  ]
];

function Faq() {
  return (
    <section className="s-faq" id="faq">
      <h2>Questions people ask first</h2>
      {FAQ.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
      {SITE.pricingNote && (
        <details>
          <summary>What does it cost?</summary>
          <p>{SITE.pricingNote}</p>
        </details>
      )}
    </section>
  );
}

function Close({ onDemo }: Props) {
  return (
    <section className="s-close">
      <h2>See today’s list for a business like yours</h2>
      <p>The demo is a small parts supplier with seven customers and ten invoices. It takes two minutes.</p>
      <div className="s-actions">
        <button className="s-btn s-btn-solid s-btn-big" onClick={onDemo}>
          Try the demo
        </button>
        {SITE.contactWhatsApp && (
          <a
            className="s-btn s-btn-line s-btn-big"
            href={whatsappLink(SITE.contactWhatsApp, 'Hi, I tried the Cash Desk demo and have a question.')}
            target="_blank"
            rel="noreferrer"
          >
            Message us on WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}

export default function Home(props: Props) {
  return (
    <div className="site">
      <Jump className="skip" to="how">
        Skip to content
      </Jump>
      <Header {...props} />
      <main>
        <Hero {...props} />
        <Stuck />
        <How />
        <Ladder />
        <Law />
        <Control />
        <Faq />
        <Close {...props} />
      </main>
      <footer className="s-foot">
        <span>Cash Desk. Payment reminders for small suppliers in India.</span>
        <span>
          The legal and tax points are general information, not advice. Customers and figures in the demo are fictional.
        </span>
      </footer>
    </div>
  );
}
