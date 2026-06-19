import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST — auto-called when a booking is marked done.
// Idempotent: if booking_id already has an invoice (unique constraint), returns
// the existing record rather than erroring.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { clinic_id, booking_id, patient_name, amount, consultation_fee, visit_date } = body as {
      clinic_id: string;
      booking_id?: string | null;
      patient_name: string;
      amount: number;
      consultation_fee: number;
      visit_date: string;
    };

    if (!clinic_id || !patient_name || !visit_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Idempotency: return existing invoice if booking_id already has one.
    if (booking_id) {
      const { data: existing, error: existErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('booking_id', booking_id)
        .maybeSingle();
      if (existErr) {
        console.error('[POST /api/invoices] idempotency check failed:', existErr.code, existErr.message);
        return NextResponse.json({ error: existErr.message, code: existErr.code }, { status: 500 });
      }
      if (existing) return NextResponse.json({ invoice: existing }, { status: 200 });
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        clinic_id,
        booking_id: booking_id || null,
        patient_name,
        amount: amount ?? 0,
        consultation_fee: consultation_fee ?? 0,
        visit_date,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /api/invoices] Supabase error:', error.code, error.message, error.details);
      // Unique violation on booking_id from a concurrent request — return existing.
      if (error.code === '23505') {
        const { data: fallback } = await supabase
          .from('invoices').select('*').eq('booking_id', booking_id!).maybeSingle();
        return NextResponse.json({ invoice: fallback }, { status: 200 });
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ invoice: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/invoices]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update invoice status and/or payment method.
// Called from the Billing page when doctor marks an invoice as paid/refunded.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { id, status, payment_method, amount } = body as {
      id: string;
      status?: string;
      payment_method?: string;
      amount?: number;
    };

    if (!id) return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (status)           update.status         = status;
    if (payment_method)   update.payment_method  = payment_method;
    if (amount !== undefined) update.amount      = amount;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('invoices')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invoice: data }, { status: 200 });
  } catch (err) {
    console.error('[PATCH /api/invoices]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
