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
    else if (mode === 'up' && !r.data.session) setMsg('Check your email to confirm your account, then sign in.');
  };

  return (
    <main className="login">
      <a className="back" href="#/">
        Back to the overview
      </a>
      <div className="brand">Cash Desk</div>
      <h1>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
      {db ? (
        <div className="card form">
          <div className="tabs small" role="tablist" aria-label="Sign in or create account">
            <button
              role="tab"
              aria-selected={mode === 'in'}
              className={mode === 'in' ? 'on' : ''}
              onClick={() => setMode('in')}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === 'up'}
              className={mode === 'up' ? 'on' : ''}
              onClick={() => setMode('up')}
            >
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
          {msg && (
            <p className="warn" role="alert">
              {msg}
            </p>
          )}
        </div>
      ) : (
        <p className="lede">Accounts are not available on this build. You can still try the demo.</p>
      )}
      <p className="sub">
        Just looking?{' '}
        <button className="linklike" onClick={onDemo}>
          Try the demo
        </button>
      </p>
    </main>
  );
}
