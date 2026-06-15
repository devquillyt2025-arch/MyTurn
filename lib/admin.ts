/**
 * Super-admin allowlist. Set ADMIN_EMAILS in the environment to a
 * comma-separated list of email addresses, e.g.
 *   ADMIN_EMAILS=owner@myturn.com,ops@myturn.com
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
