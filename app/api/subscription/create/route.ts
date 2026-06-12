import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const PLAN_IDS: Record<string, string | undefined> = {
  basic: process.env.RAZORPAY_PLAN_ID_BASIC,
  pro:   process.env.RAZORPAY_PLAN_ID_PRO,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const plan: string | undefined = body?.plan;

    if (!plan || !['basic', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planId = PLAN_IDS[plan];
    if (!planId) {
      return NextResponse.json(
        { error: `Plan ID for "${plan}" is not configured. Set RAZORPAY_PLAN_ID_${plan.toUpperCase()} in env.` },
        { status: 500 }
      );
    }

    // Authenticate the requesting doctor
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id:         planId,
      customer_notify: 1,
      total_count:     12,
      quantity:        1,
      notes: {
        doctor_id: user.id,
        plan,
      },
    });

    return NextResponse.json({ subscription_id: subscription.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/subscription/create]', err);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
