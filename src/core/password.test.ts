import { describe, expect, it } from 'vitest';
import { checkPassword } from './password';

const reply = (body: string) => (async () => new Response(body)) as unknown as typeof fetch;
const sha1 = async (pw: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

describe('password rules', () => {
  it('rejects short, common, repeated and email-based passwords', async () => {
    expect((await checkPassword('short', 'a@b.co')).ok).toBe(false);
    expect((await checkPassword('password123', 'a@b.co')).ok).toBe(false);
    expect((await checkPassword('aaaaaaaaaaaa', 'a@b.co')).ok).toBe(false);
    expect((await checkPassword('vignesh-rocks-99', 'vignesh@x.com')).ok).toBe(false);
  });

  it('sends only the first 5 hash characters to the breach service', async () => {
    let url = '';
    await checkPassword('a-long-unique-phrase-42', 'a@b.co', (async (u: string) => {
      url = String(u);
      return new Response('');
    }) as unknown as typeof fetch);
    const h = await sha1('a-long-unique-phrase-42');
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
    expect(url).not.toContain('a-long-unique-phrase');
  });

  it('rejects a password whose hash is in the breach list', async () => {
    const h = await sha1('Tr0ub4dor&3-horse');
    const r = await checkPassword('Tr0ub4dor&3-horse', 'a@b.co', reply(`${h.slice(5)}:42\nABCDEF:1`));
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/breach/i) });
  });

  it('ignores padding rows with a zero count', async () => {
    const h = await sha1('Tr0ub4dor&3-horse');
    expect((await checkPassword('Tr0ub4dor&3-horse', 'a@b.co', reply(`${h.slice(5)}:0`))).ok).toBe(true);
  });

  it('still accepts a good password when the lookup is down', async () => {
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await checkPassword('correct-horse-battery', 'a@b.co', down)).ok).toBe(true);
  });
});
