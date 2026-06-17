import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FREE_PLAN_LIMIT = 20;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// SECURITY FIX: In-memory rate limiter — max 3 booking attempts per IP per clinic per 10 minutes.
// TODO: Replace with Upstash Redis for correctness across multiple serverless instances.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string, clinicId: string): boolean {
  const key = `${ip}:${clinicId}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { clinic_id, slot_id, patient_name, patient_phone = '', source: rawSource } = body as {
      clinic_id: string;
      slot_id?: string | null;
      patient_name: string;
      patient_phone?: string;
      source?: string;
    };

    const source = rawSource === 'appointment' ? 'appointment' : 'walkin';

    if (!clinic_id || !patient_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // SECURITY FIX: Rate limit by IP + clinic_id
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';
    if (!checkRateLimit(ip, clinic_id)) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const supabase = adminClient();
    const today = new Date().toISOString().split('T')[0];

    // Resolve the clinic's plan via doctors table
    const { data: clinic } = await supabase
      .from('clinics')
      .select('user_id')
      .eq('id', clinic_id)
      .single();

    let plan = 'free';
    if (clinic?.user_id) {
      const { data: doctor } = await supabase
        .from('doctors')
        .select('plan')
        .eq('id', clinic.user_id)
        .single();
      plan = doctor?.plan ?? 'free';
    }

    // Enforce daily booking limit on free plan
    let currentCount = 0;
    let logRowExists = false;

    if (plan === 'free') {
      const { data: log } = await supabase
        .from('usage_logs')
        .select('booking_count')
        .eq('clinic_id', clinic_id)
        .eq('date', today)
        .single();

      currentCount = log?.booking_count ?? 0;
      logRowExists = !!log;

      if (currentCount >= FREE_PLAN_LIMIT) {
        return NextResponse.json(
          { error: 'Daily booking limit reached. Ask your doctor to upgrade to MyTurn Basic.' },
          { status: 429 }
        );
      }
    }

    // Walk-ins get a token immediately; appointments get one only at check-in.
    let assignedToken: number | null = null;
    let checkedInAt: string | null = null;

    if (source === 'walkin') {
      const { data: nextToken, error: tokenError } = await supabase.rpc('get_next_token', {
        p_clinic_id: clinic_id,
      });
      if (tokenError || nextToken === null || nextToken === undefined) {
        console.error('[POST /api/bookings] get_next_token error:', tokenError);
        return NextResponse.json({ error: 'Failed to assign token number' }, { status: 500 });
      }
      assignedToken = nextToken as number;
      checkedInAt = new Date().toISOString();
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        slot_id: slot_id ?? null,
        clinic_id,
        patient_name,
        patient_phone,
        token_number: assignedToken,
        status: 'waiting',
        source,
        checked_in_at: checkedInAt,
      })
      .select('id, token_number, source')
      .single();

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    // Increment usage count for free plan
    if (plan === 'free') {
      if (logRowExists) {
        await supabase
          .from('usage_logs')
          .update({ booking_count: currentCount + 1 })
          .eq('clinic_id', clinic_id)
          .eq('date', today);
      } else {
        await supabase
          .from('usage_logs')
          .insert({ clinic_id, date: today, booking_count: 1 });
      }
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/bookings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
