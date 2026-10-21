import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
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
    const r =
      mode === 'in'
        ? await db.auth.signInWithPassword({ email, password: pw })
        : await db.auth.signUp({ email, password: pw });
    setBusy(false);
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up' && !r.data.session) setMsg('Check your email to confirm, then sign in.');
  };

  return (
    <main className="login">
      <div className="brand">Cash Desk</div>
      <h1>Know who owes you. Ask them without the awkwardness.</h1>
      <p className="lede">
        Each morning, a short list of messages that are ready to send on WhatsApp. You read, you tap, it is done.
      </p>
      <button className="btn primary big" onClick={onDemo}>
        Try the demo (no sign-up)
      </button>
      <p className="sub">Sample business, fictional customers, stays in your browser.</p>
      {db && (
        <div className="card form">
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
          <Field label="Password" hint={mode === 'up' ? 'At least 8 characters' : undefined}>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </Field>
          <button className="btn primary" disabled={busy || !email.includes('@') || pw.length < 8} onClick={submit}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
          {msg && <p className="warn">{msg}</p>}
        </div>
      )}
    </main>
  );
}
