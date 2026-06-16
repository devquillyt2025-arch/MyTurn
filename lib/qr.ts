import crypto from 'crypto';

/**
 * Generates a cryptographically strong, collision-proof QR token.
 * Format: SHA-256 of (clinicId + randomUUID + timestamp + secret salt)
 * Output: 64-char hex string = 256 bits of entropy.
 *
 * SERVER-ONLY: uses Node's `crypto`. Do not import this into a client component
 * (it would break the browser bundle). New clinic rows also receive a strong
 * token automatically via the `clinics.qr_token` column DEFAULT (pgcrypto), so
 * this is only needed for explicit regeneration.
 */
export function generateQRToken(clinicId: string): string {
  const salt = process.env.QR_TOKEN_SECRET ?? 'myturnapp-qr-salt-fallback';
  const payload = `${clinicId}:${crypto.randomUUID()}:${Date.now()}:${salt}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Returns the public QR URL (/q/<token>) for a clinic. Isomorphic — safe to call
 * anywhere. Uses the existing booking base URL (falls back to NEXT_PUBLIC_APP_URL
 * then the production domain).
 */
export function getQRUrl(qrToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_BOOKING_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://myturnapp.online';
  return `${base.replace(/\/$/, '')}/q/${qrToken}`;
}
