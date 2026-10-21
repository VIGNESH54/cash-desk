export interface PhoneInfo {
  valid: boolean;
  /** digits with country code and no plus, e.g. 919876543210 */
  digits: string;
  /** +919876543210 */
  e164: string;
  /** nicer for humans: +91 98765 43210 */
  pretty: string;
}

const EMPTY: PhoneInfo = { valid: false, digits: '', e164: '', pretty: '' };

/** Normalises phone numbers typed or exported in many shapes. Defaults to India (+91). */
export function normalizePhone(input: string | null | undefined, defaultCountry = '91'): PhoneInfo {
  if (!input) return EMPTY;
  const raw = input.trim();
  const hasPlus = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return EMPTY;
  if (raw.startsWith('00')) digits = digits.slice(2);

  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) digits = defaultCountry + digits;
  }

  if (digits.startsWith('91') && digits.length === 12) {
    const national = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(national)) return EMPTY;
    return {
      valid: true,
      digits,
      e164: `+${digits}`,
      pretty: `+91 ${national.slice(0, 5)} ${national.slice(5)}`
    };
  }

  if (hasPlus && digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0')) {
    return { valid: true, digits, e164: `+${digits}`, pretty: `+${digits}` };
  }
  return EMPTY;
}

/** Opens WhatsApp with the message ready to send. Works on phones and on WhatsApp Web. */
export function whatsappLink(phone: string, text: string): string {
  const info = normalizePhone(phone);
  const base = info.valid ? `https://wa.me/${info.digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone: string, text: string): string {
  const info = normalizePhone(phone);
  return `sms:${info.valid ? info.e164 : ''}?body=${encodeURIComponent(text)}`;
}
