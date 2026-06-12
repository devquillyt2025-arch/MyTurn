import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    // Raw body required for HMAC verification — must call text() before json()
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') ?? '';

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === 'payment.captured') {
      const payment   = payload.payload?.payment?.entity;
      const doctorId: string | undefined = payment?.notes?.doctor_id;
      const plan: string | undefined     = payment?.notes?.plan;

      if (doctorId && plan && ['basic', 'pro'].includes(plan)) {
        const supabase = adminClient();
        const { error } = await supabase
          .from('doctors')
          .update({ plan })
          .eq('id', doctorId);

        if (error) {
          console.error('[webhook] failed to update plan:', error.message);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[POST /api/subscription/verify]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
