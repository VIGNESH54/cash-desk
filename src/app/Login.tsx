import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkPassword, MIN_PASSWORD } from '../core/password';
import { Field } from './ui';

export default function Login({ db, onDemo }: { db: SupabaseClient | null; onDemo(): void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!db) return;
    setBusy(true);
    setMsg('');
    if (mode === 'up') {
      const ok = await checkPassword(pw, email);
      if (!ok.ok) {
        setBusy(false);
        setMsg(ok.message);
        return;
      }
    }
    const r =
      mode === 'in'
        ? await db.auth.signInWithPassword({ email, password: pw })
        : await db.auth.signUp({ email, password: pw });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up' && !r.data.session) setMsg('Check your email to confirm, then sign in.');
  };

  return (
    <main className="landing">
      <section className="hero">
        <div className="copy">
          <div className="brand">Cash Desk</div>
          <h1>Get paid on time without the awkward phone calls.</h1>
          <p className="lede">
            Every morning, Cash Desk lists who to remind and writes the message for you. You read it, tap send on
            WhatsApp, and it is done. It knows when a customer is about to cross the legal payment limit, before it
            costs you.
          </p>
          <button className="btn primary big" onClick={onDemo}>
            Try the demo, no sign-up
          </button>
          <p className="sub">A sample business with fictional customers. Nothing leaves your browser.</p>
        </div>
        <div className="preview" aria-hidden="true">
          <div className="pv-head">
            <span>Today</span>
            <b>5 messages ready</b>
          </div>
          <div className="pv-card">
            <div className="between">
              <strong>Sharma Auto Components</strong>
              <span className="pill pill-red">Legal limit heads-up</span>
            </div>
            <div className="sub">₹4,80,000 · reaches the 45-day limit in 4 days</div>
            <pre>
              Hello Accounts team,{'\n\n'}Invoice INV-2207 reaches its 45-day legal payment limit on 25 Oct. Please
              confirm the payment date.
            </pre>
            <div className="pv-btn">Open WhatsApp</div>
          </div>
          <div className="pv-stats">
            <div>
              <span>Overdue</span>
              <b>₹6.25L</b>
            </div>
            <div>
              <span>Past legal limit</span>
              <b>₹3.15L</b>
            </div>
          </div>
        </div>
      </section>
      <section className="how">
        <div>
          <b>1. Bring your bills</b>
          <p>Import from Tally, Busy or Excel. Takes a few minutes.</p>
        </div>
        <div>
          <b>2. Read and send</b>
          <p>Each message is written for the customer and the stage. You edit and tap send.</p>
        </div>
        <div>
          <b>3. Keep the record</b>
          <p>Promises, replies and payments in one history. Print a statement with interest.</p>
        </div>
      </section>
      <p className="sub honest">
        You stay in control: nothing is sent without your tap, and the legal wording is off until you switch it on for a
        customer. Check legal points with your CA.
      </p>
      {db && (
        <div className="card form signin">
          <h2>Sign in to your business</h2>
          <div className="tabs small">
            <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>
              Sign in
            </button>
            <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>
              Create account
            </button>
          </div>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === 'up' ? `At least ${MIN_PASSWORD} characters` : undefined}>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </Field>
          <button
            className="btn primary"
            disabled={busy || !email.includes('@') || pw.length < (mode === 'up' ? MIN_PASSWORD : 1)}
            onClick={submit}
          >
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
          {msg && <p className="warn">{msg}</p>}
        </div>
      )}
    </main>
  );
}
