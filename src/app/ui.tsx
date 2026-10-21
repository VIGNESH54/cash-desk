import { useEffect, useState, type ReactNode } from 'react';
import { formatINR } from '../core/money';
import type { Stage } from '../core/ledger';

export const Money = ({ v, dec }: { v: number; dec?: boolean }) => (
  <span className="mono">{formatINR(v, { decimals: dec })}</span>
);

export function Pill({ tone, children }: { tone: 'red' | 'amber' | 'green' | 'grey' | 'navy'; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export const stagePill = (stage: Stage, days: number) =>
  stage === 'paid' ? (
    <Pill tone="green">Paid</Pill>
  ) : stage === 'overdue' ? (
    <Pill tone="red">{days}d late</Pill>
  ) : stage === 'due_today' ? (
    <Pill tone="amber">Due today</Pill>
  ) : (
    <Pill tone="grey">Due in {-days}d</Pill>
  );

export function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn ghost"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
