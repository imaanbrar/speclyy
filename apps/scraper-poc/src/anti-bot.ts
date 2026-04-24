// Unambiguous "you have been blocked" signals — match anywhere, accept as-is.
const DEFINITE_BLOCK: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /Additional security check is required/i, label: 'imperva' },
  { pattern: /<title[^>]*>\s*Just a moment/i, label: 'cloudflare-turnstile' },
  {
    pattern: /cf-browser-verification|cf-challenge/i,
    label: 'cloudflare-challenge',
  },
  {
    pattern: /<title[^>]*>\s*Attention Required/i,
    label: 'cloudflare-attention',
  },
  { pattern: /challenges\.cloudflare\.com/i, label: 'cloudflare-turnstile' },
  { pattern: /Access Denied/i, label: 'generic-access-denied' },
  { pattern: /You (have been|are) blocked/i, label: 'generic-blocked' },
  { pattern: /Pardon Our Interruption/i, label: 'distil' },
  {
    pattern: /unable to display the requested page/i,
    label: 'akamai-geo-block',
  },
  { pattern: /due to website restrictions/i, label: 'generic-geo-block' },
  { pattern: /Reference #\d+\.[0-9a-f]+/i, label: 'akamai-reference' },
  { pattern: /Incapsula|_incap_|_Incapsula_Resource/i, label: 'imperva-shell' },
];

// Captcha widgets commonly ride on normal pages (newsletter, contact forms).
// Only treat as a block when the page looks like a dedicated challenge.
function detectCaptchaChallenge(html: string): string | null {
  const hasRecaptcha = /google\.com\/recaptcha/i.test(html);
  const hasHcaptcha = /hcaptcha\.com\/captcha|\bh-captcha\b/i.test(html);
  if (!hasRecaptcha && !hasHcaptcha) return null;

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = (titleMatch?.[1] ?? '').toLowerCase();
  const challengeTitle =
    /\b(verify|human|security check|access denied|challenge|are you a)\b/.test(
      title,
    );

  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const veryShort = visibleText.length < 2000;

  if (challengeTitle || veryShort) {
    return hasHcaptcha ? 'hcaptcha-challenge' : 'recaptcha-challenge';
  }
  return null;
}

export function detectAntiBot(html: string): string | null {
  for (const { pattern, label } of DEFINITE_BLOCK) {
    if (pattern.test(html)) return label;
  }
  return detectCaptchaChallenge(html);
}
