// Dates are plain 'YYYY-MM-DD' strings. All arithmetic is done in UTC so a day is always 24h.
export type IsoDate = string;

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseISO(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function isValidISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(parseISO(s)) === s;
}

export function addDays(s: IsoDate, n: number): IsoDate {
  return toISO(new Date(parseISO(s).getTime() + n * DAY_MS));
}

/** Whole days from a to b. Positive when b is after a. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS);
}

/** Calendar-month addition. 31 Jan + 1 month = 28/29 Feb. */
export function addMonths(s: IsoDate, n: number): IsoDate {
  const d = parseISO(s);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toISO(target);
}

export function todayISO(tz = 'Asia/Kolkata', now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/** 0 = Sunday */
export function weekday(s: IsoDate): number {
  return parseISO(s).getUTCDay();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayName(s: IsoDate): string {
  return WEEKDAYS[weekday(s)];
}

export function formatDate(s: IsoDate): string {
  const d = parseISO(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatShort(s: IsoDate): string {
  const d = parseISO(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function monthKey(s: IsoDate): string {
  return s.slice(0, 7);
}
