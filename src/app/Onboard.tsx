import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBusiness } from '../data/supabase';
import { Field } from './ui';
import type { UdyamStatus } from '../core/types';

export default function Onboard({ db, onDone }: { db: SupabaseClient; onDone(id: string): void }) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [udyam, setUdyam] = useState<UdyamStatus>('unknown');
  const [err, setErr] = useState('');
  return (
    <main className="login">
      <div className="brand">Cash Desk</div>
      <h1>Set up your business</h1>
      <div className="card form">
        <Field label="Business name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Your name">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        <Field label="Your WhatsApp number">
          <input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Udyam registration">
          <select value={udyam} onChange={(e) => setUdyam(e.target.value as UdyamStatus)}>
            <option value="unknown">Not sure</option>
            <option value="not_registered">Not registered</option>
            <option value="registered_micro">Registered, micro</option>
            <option value="registered_small">Registered, small</option>
          </select>
        </Field>
        <button
          className="btn primary"
          disabled={!name.trim()}
          onClick={async () => {
            try {
              onDone(
                await createBusiness(db, {
                  name: name.trim(),
                  ownerName: owner || undefined,
                  ownerPhone: phone || undefined,
                  udyam
                })
              );
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          Create
        </button>
        {err && <p className="warn">{err}</p>}
      </div>
    </main>
  );
}
