// Sign-up password checks. The breach lookup uses the k-anonymity range API: only the first 5 characters
// of the password's SHA-1 hash leave the browser, never the password.

export const MIN_PASSWORD = 10;

const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  '12345678910',
  'qwertyuiop',
  'iloveyou12',
  'welcome123',
  'cashdesk123'
]);

export type PasswordResult = { ok: true } | { ok: false; message: string };

async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export async function checkPassword(
  password: string,
  email: string,
  fetchImpl: typeof fetch = fetch
): Promise<PasswordResult> {
  if (password.length < MIN_PASSWORD) return { ok: false, message: `Use at least ${MIN_PASSWORD} characters.` };
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password))
    return { ok: false, message: 'That password is too easy to guess.' };
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local))
    return { ok: false, message: 'Do not use your email name in your password.' };

  try {
    const hash = await sha1Hex(password);
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' }
    });
    if (res.ok) {
      const suffix = hash.slice(5);
      const hit = (await res.text()).split('\n').some((line) => {
        const [s, count] = line.trim().split(':');
        return s === suffix && Number(count) > 0;
      });
      if (hit) return { ok: false, message: 'This password appeared in a data breach. Choose a different one.' };
    }
  } catch {
    /* the lookup is a bonus: if it is unreachable, the other rules still apply */
  }
  return { ok: true };
}
