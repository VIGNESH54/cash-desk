import { useState } from 'react';
import { Field } from './ui';
import { useApp } from './Store';
import { normalizePhone } from '../core/phone';
import { addMemberByEmail, supabase } from '../data/supabase';
import type { Business, UdyamStatus } from '../core/types';

export default function Settings({ businessId, onSignOut }: { businessId?: string; onSignOut(): void }) {
  const { snap, repo, run, dayOffset, setDayOffset, resetDemo, today } = useApp();
  const [f, setF] = useState<Business>(snap.business);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const set = <K extends keyof Business>(k: K, v: Business[K]) => setF((p) => ({ ...p, [k]: v }));
  const badPhone = !!f.ownerPhone && !normalizePhone(f.ownerPhone).valid;
  const rateBad = !(f.bankRate > 0 && f.bankRate < 30);
  const dirty = JSON.stringify(f) !== JSON.stringify(snap.business);

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashdesk-export-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h1>Settings</h1>
      <div className="card form">
        <Field label="Business name">
          <input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="two">
          <Field label="Your name">
            <input value={f.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} />
          </Field>
          <Field label="Your WhatsApp (for the brief)" hint={badPhone ? 'Does not look valid' : undefined}>
            <input value={f.ownerPhone ?? ''} inputMode="tel" onChange={(e) => set('ownerPhone', e.target.value)} />
          </Field>
        </div>
        <Field
          label="Udyam registration"
          hint="Legal wording only works for registered micro or small suppliers. Check with your CA if unsure."
        >
          <select value={f.udyamStatus} onChange={(e) => set('udyamStatus', e.target.value as UdyamStatus)}>
            <option value="unknown">Not sure</option>
            <option value="not_registered">Not registered</option>
            <option value="registered_micro">Registered, micro</option>
            <option value="registered_small">Registered, small</option>
          </select>
        </Field>
        <Field
          label="RBI bank rate (%)"
          hint="Check the current rate on rbi.org.in. Statutory interest is 3 times this, compounded monthly. This is a claim figure, not a guarantee."
        >
          <input
            value={String(f.bankRate)}
            inputMode="decimal"
            onChange={(e) => set('bankRate', Number(e.target.value))}
          />
        </Field>
        <Field label="How customers should pay" hint="Printed at the end of each reminder. Max 200 characters.">
          <textarea
            rows={2}
            maxLength={200}
            value={f.payInstructions ?? ''}
            onChange={(e) => set('payInstructions', e.target.value)}
            placeholder="UPI: yourshop@bank · A/c 1234…"
          />
        </Field>
        <button
          className="btn primary"
          disabled={!dirty || !f.name.trim() || badPhone || rateBad}
          onClick={() =>
            run(() =>
              repo.saveBusiness({
                name: f.name.trim(),
                ownerName: f.ownerName,
                ownerPhone: f.ownerPhone,
                udyamStatus: f.udyamStatus,
                bankRate: f.bankRate,
                payInstructions: f.payInstructions
              })
            )
          }
        >
          Save settings
        </button>
      </div>

      {repo.mode === 'cloud' && supabase && businessId && (
        <>
          <h2>Team</h2>
          <div className="card form">
            <Field
              label="Invite a teammate by email"
              hint="They sign in with this email. We never confirm whether an email already has an account."
            >
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button
              className="btn"
              disabled={!email.includes('@')}
              onClick={async () => {
                try {
                  await addMemberByEmail(supabase!, businessId, email.trim(), 'operator');
                  setMsg(
                    'Invitation saved. If that email has an account, or signs up with it, they get access the next time they sign in.'
                  );
                  setEmail('');
                } catch (e) {
                  setMsg((e as Error).message);
                }
              }}
            >
              Send invite
            </button>
            {msg && <p className="sub">{msg}</p>}
          </div>
        </>
      )}

      <h2>Your data</h2>
      <div className="card form row wrap">
        <button className="btn" onClick={exportJson}>
          Download everything (JSON)
        </button>
        <button className="btn ghost" onClick={onSignOut}>
          {repo.mode === 'demo' ? 'Leave demo' : 'Sign out'}
        </button>
      </div>

      {repo.mode === 'demo' && (
        <>
          <h2>Demo controls</h2>
          <div className="card form">
            <p className="sub">
              Jump forward to see how the reminders escalate over time. Sample data is fictional and stays in this
              browser.
            </p>
            <div className="row wrap">
              <button className="btn" onClick={() => setDayOffset(dayOffset + 1)}>
                +1 day
              </button>
              <button className="btn" onClick={() => setDayOffset(dayOffset + 7)}>
                +1 week
              </button>
              <button className="btn ghost" onClick={resetDemo}>
                Reset demo
              </button>
              <span className="sub">
                Showing {today}
                {dayOffset ? ` (${dayOffset} days ahead)` : ''}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
