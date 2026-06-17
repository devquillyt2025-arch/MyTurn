import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const { id } = body as { id: string };
    if (!id) {
      return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
    }

    const supabase = adminClient();

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, clinic_id, source, token_number')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.source !== 'appointment') {
      return NextResponse.json({ error: 'Only appointment bookings can be checked in' }, { status: 400 });
    }

    if (booking.token_number !== null) {
      return NextResponse.json({ error: 'Booking already checked in' }, { status: 409 });
    }

    const { data: nextToken, error: tokenError } = await supabase.rpc('get_next_token', {
      p_clinic_id: booking.clinic_id,
    });

    if (tokenError || nextToken === null || nextToken === undefined) {
      console.error('[POST /api/bookings/checkin] get_next_token error:', tokenError);
      return NextResponse.json({ error: 'Failed to assign token number' }, { status: 500 });
    }

    // .is() guard ensures the UPDATE is a no-op if a concurrent request already checked in.
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        token_number: nextToken as number,
        checked_in_at: new Date().toISOString(),
        status: 'waiting',
      })
      .eq('id', id)
      .is('token_number', null)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: 'Check-in failed — booking may have already been checked in' },
        { status: 409 }
      );
    }

    return NextResponse.json({ booking: updated }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/bookings/checkin]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
