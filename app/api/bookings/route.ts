import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FREE_PLAN_LIMIT = 20;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { clinic_id, slot_id, patient_name, patient_phone, token_number } = body as {
      clinic_id: string;
      slot_id?: string | null;
      patient_name: string;
      patient_phone: string;
      token_number: number;
    };

    if (!clinic_id || !patient_name || !patient_phone || !token_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
          { error: 'Daily booking limit reached. Ask your doctor to upgrade to MyTurnApp Basic.' },
          { status: 429 }
        );
      }
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        slot_id: slot_id ?? null,
        clinic_id,
        patient_name,
        patient_phone,
        token_number,
        status: 'waiting',
      })
      .select('id, token_number')
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
