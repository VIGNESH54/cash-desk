import { addDays, formatDate, formatShort, weekdayName, type IsoDate } from './dates';
import { buildViews, collectedBetween, totals, type InvoiceView } from './ledger';
import { formatINR } from './money';
import { attention, planDay, type Attention } from './planner';
import type { Snapshot } from './types';

export interface Brief {
  date: IsoDate;
  receivedToday: number;
  receivedCount: number;
  outstanding: number;
  overdue: number;
  crossingSoon: InvoiceView[];
  promisesSoon: InvoiceView[];
  brokenPromises: InvoiceView[];
  needsCall: Attention[];
  queueTomorrow: number;
  interestOnPaper: number;
  text: string;
}

/** The nightly summary the owner gets on WhatsApp. Plain text with WhatsApp bold. */
export function buildBrief(s: Snapshot, today: IsoDate): Brief {
  const views = buildViews(s, today);
  const t = totals(views);
  const receivedToday = collectedBetween(s, today, today);
  const receivedCount = s.payments.filter((p) => p.paidOn === today).length;

  const crossingSoon = views
    .filter((v) => v.legalOn && v.stage !== 'paid' && v.daysToLegal >= 0 && v.daysToLegal <= 7)
    .sort((a, b) => a.daysToLegal - b.daysToLegal);

  const tomorrow = addDays(today, 1);
  const promisesSoon = views
    .filter((v) => v.activePromise && v.activePromise.promisedOn <= tomorrow)
    .sort((a, b) => a.activePromise!.promisedOn.localeCompare(b.activePromise!.promisedOn));
  const brokenPromises = views.filter((v) => v.brokenPromise);
  const needsCall = attention(s, today);
  const queueTomorrow = planDay(s, tomorrow).length;

  const L: string[] = [];
  L.push(`*Cash brief, ${weekdayName(today)} ${formatShort(today)}* — ${s.business.name}`);
  L.push('');
  L.push('*Received today*');
  L.push(
    receivedToday > 0
      ? `${formatINR(receivedToday)} in ${receivedCount} ${receivedCount === 1 ? 'payment' : 'payments'}`
      : 'Nothing received today'
  );
  L.push('');
  L.push('*Owed to you*');
  L.push(`${formatINR(t.outstanding)} in total, ${formatINR(t.overdue)} overdue`);
  if (t.interestOnPaper > 0) L.push(`Interest on paper: ${formatINR(t.interestOnPaper)}`);

  if (crossingSoon.length) {
    L.push('', '*Crossing the legal limit this week*');
    for (const v of crossingSoon.slice(0, 4)) {
      const when = v.daysToLegal === 0 ? 'today' : `in ${v.daysToLegal} ${v.daysToLegal === 1 ? 'day' : 'days'}`;
      L.push(`• ${v.customer.name}: ${formatINR(v.balance)}, ${when}`);
    }
  }
  if (promisesSoon.length) {
    L.push('', '*Promised payments*');
    for (const v of promisesSoon.slice(0, 4)) {
      L.push(`• ${v.customer.name}: ${formatINR(v.balance)} on ${formatDate(v.activePromise!.promisedOn)}`);
    }
  }
  if (brokenPromises.length) {
    L.push('', '*Missed promises*');
    for (const v of brokenPromises.slice(0, 4)) {
      L.push(`• ${v.customer.name}: ${formatINR(v.balance)}, promised ${formatDate(v.brokenPromise!.promisedOn)}`);
    }
  }
  if (needsCall.length) {
    L.push('', '*Needs a call from you*');
    for (const a of needsCall.slice(0, 4)) L.push(`• ${a.customerName}: ${a.detail}`);
  }
  L.push(
    '',
    queueTomorrow > 0
      ? `Tomorrow: ${queueTomorrow} ${queueTomorrow === 1 ? 'message' : 'messages'} ready to send.`
      : 'Tomorrow: no messages due.'
  );

  return {
    date: today,
    receivedToday,
    receivedCount,
    outstanding: t.outstanding,
    overdue: t.overdue,
    crossingSoon,
    promisesSoon,
    brokenPromises,
    needsCall,
    queueTomorrow,
    interestOnPaper: t.interestOnPaper,
    text: L.join('\n')
  };
}
