export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function groupIndian(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** 480000 -> "₹4,80,000". Pass decimals to keep paise. */
export function formatINR(n: number, opts: { decimals?: boolean } = {}): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = opts.decimals ? abs.toFixed(2) : String(Math.round(abs));
  const [int, frac] = fixed.split('.');
  return `${neg ? '-' : ''}₹${groupIndian(int)}${frac ? '.' + frac : ''}`;
}

/** Short form for tight spaces: ₹4.8L, ₹1.2Cr */
export function formatINRShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

function trim(n: number): string {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '');
}

/**
 * Parses amounts as they appear in Indian accounting exports:
 * "₹ 1,25,000.50", "Rs. 500", "1,00,000 Dr", "(2,500)".
 * Returns null when it is not a number.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bcr\.?$/i.test(s)) negative = !negative; // credit balances are reversed
  s = s
    .replace(/\b(dr|cr)\.?$/i, '')
    .replace(/(rs\.?|inr|₹)/gi, '')
    .replace(/[,\s]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}
