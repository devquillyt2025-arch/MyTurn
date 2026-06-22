import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Always resolve fresh — tokens can be regenerated.
export const dynamic = 'force-dynamic';

/**
 * Public, unauthenticated QR landing route. A patient scans the clinic's QR
 * (which encodes /q/<opaque-token>), we resolve the token to the clinic, and
 * hand off to the existing /book/<slug> queue flow. The opaque token is the
 * unguessable front door; the slug stays an internal routing detail.
 */
export default async function QrResolverPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('clinics')
    .select('slug')
    .eq('qr_token', params.token)
    .single();

  if (data?.slug) {
    redirect(`/walkin/${data.slug}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: '#0A0E14',
        color: '#e2e8f0',
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, color: '#475569' }}>404</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>Invalid or expired QR code</div>
      <div style={{ fontSize: 14, color: '#94a3b8', maxWidth: 320 }}>
        This QR code doesn&apos;t match any clinic. It may have been regenerated — ask the
        clinic for their current code.
      </div>
      <a href="/" style={{ marginTop: 8, color: '#0D7377', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>
        ← Back to MyTurn
      </a>
    </div>
  );
}
