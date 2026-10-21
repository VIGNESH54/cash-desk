import { formatDate, type IsoDate } from './dates';
import { formatINR } from './money';
import type { InvoiceView } from './ledger';
import type { Business, Customer } from './types';

export type Level = 'friendly' | 'firm' | 'legal';

export function stepBase(step: string): string {
  return step.split(':')[0];
}

export function stepLevel(step: string): Level {
  const b = stepBase(step);
  if (b.startsWith('legal_') || b.startsWith('interest_')) return 'legal';
  if (b === 'due' || b === 'nudge') return 'friendly';
  return 'firm';
}

export function stepLabel(step: string): string {
  const b = stepBase(step);
  if (b.startsWith('weekly_')) return 'Weekly follow-up';
  if (b.startsWith('interest_')) return 'Interest statement';
  switch (b) {
    case 'due':
      return 'Due today';
    case 'nudge':
      return 'Gentle nudge';
    case 'accounts':
      return 'To accounts team';
    case 'firm':
      return 'Firm follow-up';
    case 'legal_heads_up':
      return 'Legal limit heads-up';
    case 'legal_passed':
      return 'Legal limit passed';
    case 'promise_check':
      return 'Promise due today';
    case 'promise_broken':
      return 'Promise missed';
    default:
      return b;
  }
}

export interface ComposeInput {
  business: Business;
  customer: Customer;
  views: InvoiceView[];
  step: string;
  today: IsoDate;
  /** date of the promise, for promise_* steps */
  promiseOn?: IsoDate;
  includeOptOut?: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Builds the message text. Pure function: same input, same words. */
export function composeMessage(i: ComposeInput): string {
  const { business: biz, customer: c } = i;
  const base = stepBase(i.step);
  const level = stepLevel(i.step);
  const views = [...i.views].sort((a, b) => b.daysOverdue - a.daysOverdue);
  const count = views.length;
  const single = count === 1;
  const v0 = views[0];

  // Legal wording and accounts-team notes are always in English.
  const hinglish = c.language === 'hinglish' && level !== 'legal' && base !== 'accounts';
  const name = c.contactPerson?.trim() || c.name;
  const greet =
    level === 'legal' || base === 'accounts'
      ? `Hello Accounts team at ${c.name},`
      : hinglish
        ? `Namaste ${name} ji,`
        : `Hello ${name},`;

  const maxDays = Math.max(0, ...views.map((v) => v.daysOverdue));
  const be = single ? 'is' : 'are';
  const inv = single
    ? hinglish
      ? `invoice ${v0.invoice.number} (${formatINR(v0.balance)})`
      : `invoice ${v0.invoice.number} for ${formatINR(v0.balance)}`
    : hinglish
      ? 'neeche likhe invoices'
      : 'the invoices listed below';

  const daysEn = single ? `${maxDays} ${plural(maxDays, 'day', 'days')}` : `up to ${maxDays} days`;
  const daysHi = single ? `${maxDays} din` : `sabse purana ${maxDays} din`;
  const size = biz.udyamStatus === 'registered_micro' ? 'micro' : 'small';
  const total = views.reduce((a, v) => a + v.balance, 0);

  let list = '';
  if (!single) {
    const lines = views.map((v) => {
      if (level === 'legal') {
        return `• ${v.invoice.number}: ${formatINR(v.balance)}, legal limit ${formatDate(v.legalDue)}`;
      }
      return v.daysOverdue > 0
        ? `• ${v.invoice.number}: ${formatINR(v.balance)} (${v.daysOverdue} days overdue)`
        : `• ${v.invoice.number}: ${formatINR(v.balance)} (due ${formatDate(v.agreedDue)})`;
    });
    list = `${lines.join('\n')}\nTotal: ${formatINR(total)}`;
  }

  const promiseDate = i.promiseOn ? formatDate(i.promiseOn) : '';
  let core: string;

  if (hinglish) {
    switch (base) {
      case 'due':
        core = `${biz.name} ki taraf se yaad dilana tha: ${inv} ka payment aaj due hai. Dhanyavaad.`;
        break;
      case 'nudge':
        core = `${inv} ka payment ${daysHi} se pending hai. Kya aap bata sakte hain ki payment kab tak ho jayega?`;
        break;
      case 'promise_check':
        core = `aapne aaj payment ka bola tha (${inv}). Kya ho gaya?`;
        break;
      case 'promise_broken':
        core = `aapne ${promiseDate} tak payment ka bola tha (${inv}), abhi tak nahi aaya. Nayi date bata dijiye?`;
        break;
      default: // firm, weekly
        core = base.startsWith('weekly_')
          ? `${inv} abhi bhi pending hai (${daysHi}). Kripya aaj payment status bata dijiye.`
          : `${inv} ka payment ${daysHi} se baaki hai. Kripya is hafte payment kar dijiye, ya koi dikkat ho to humein call kijiye.`;
    }
  } else if (base.startsWith('interest_')) {
    const interest = views.reduce((a, v) => a + v.interest, 0);
    core =
      `${inv} from ${biz.name} ${single ? 'remains' : 'remain'} unpaid past the legal payment limit. ` +
      `Interest accrued to date under Section 16 of the MSMED Act: ${formatINR(interest)} on ${formatINR(total)}. ` +
      `A statement of dues is attached. We would prefer to close this by payment this week. Please confirm the date.`;
  } else {
    switch (base) {
      case 'due':
        core = `a reminder from ${biz.name}: ${inv} ${be} due today.`;
        break;
      case 'nudge':
        core = `a gentle reminder from ${biz.name}: ${inv} ${be} ${daysEn} past the due date. Could you confirm when we can expect payment?`;
        break;
      case 'accounts':
        core = `${biz.name} requests payment of ${inv}, ${daysEn} overdue. Please share the payment date, or let us know if any query is holding it up.`;
        break;
      case 'firm':
        core = `${inv} to ${biz.name} ${be} now ${daysEn} overdue. Please arrange payment this week, or call us if there is a problem.`;
        break;
      case 'legal_heads_up': {
        const when = single
          ? `${formatDate(v0.legalDue)} (${v0.daysToLegal <= 0 ? 'today' : `in ${v0.daysToLegal} ${plural(v0.daysToLegal, 'day', 'days')}`})`
          : 'the dates shown below';
        const limit = single ? `${v0.limitDays}-day ` : '';
        core =
          `${inv} from ${biz.name}, a registered ${size} enterprise, ${single ? 'reaches its' : 'reach their'} ${limit}legal payment limit on ${when}. ` +
          `After that date interest can accrue under the MSMED Act, and under Section 43B(h) the tax deduction for a late-paid bill moves to the year of payment. ` +
          `Please confirm the payment date.`;
        break;
      }
      case 'legal_passed': {
        const when = single ? `on ${formatDate(v0.legalDue)}` : '(dates shown below)';
        core =
          `${inv} from ${biz.name}, a registered ${size} enterprise, passed the legal payment limit ${when}.` +
          `Interest under Section 16 of the MSMED Act now accrues on the unpaid amount. ` +
          `Please settle at the earliest and confirm the payment date. We can share a statement of dues on request.`;
        break;
      }
      case 'promise_check':
        core = `you mentioned payment today for ${inv}. Could you confirm the status?`;
        break;
      case 'promise_broken':
        core = `you had mentioned payment by ${promiseDate} for ${inv}, which ${be} still pending. Could you share a new date?`;
        break;
      default: // weekly
        core = `a follow-up from ${biz.name}: ${inv} ${be} still unpaid (${daysEn} overdue). Kindly confirm the payment status today.`;
    }
  }

  const parts: string[] = [greet, '', capitalise(core)];
  if (list) parts.push('', list);
  if (biz.payInstructions?.trim()) parts.push('', `Pay: ${biz.payInstructions.trim()}`);
  parts.push('', `— ${biz.name}`);
  if (i.includeOptOut !== false) parts.push('Reply STOP to stop these reminders.');
  return parts.join('\n');
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
