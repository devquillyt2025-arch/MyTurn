import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SECURITY FIX: Reject requests that don't originate from known domains.
// Same-origin requests (no Origin header) are allowed through — this targets
// cross-origin script abuse only.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://myturnapp.online',
  'https://www.myturnapp.online',
];

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Origin header check
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY FIX: Verify the caller's identity via the Authorization header.
    // The client must pass its Supabase session access token as a Bearer token.
    // We use the service role client to validate the JWT — this rejects forged or
    // expired tokens. The user_id in the request body is ignored entirely.
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const { clinic_name, doctor_name, phone, email } = body ?? {};

    if (!clinic_name || !doctor_name || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // user.id comes from the verified JWT — not from the request body
    const { error } = await adminSupabase.from('doctors').insert({
      id: user.id,
      clinic_name,
      doctor_name,
      phone,
      email,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
