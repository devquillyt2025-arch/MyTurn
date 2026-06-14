'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import styles from './page.module.css';
import toast from 'react-hot-toast';

type Plan = 'free' | 'basic' | 'pro';

const PLANS = [
  {
    id: 'basic' as const,
    name: 'Basic',
    price: '₹999',
    period: '/month',
    description: 'For growing clinics ready to go unlimited',
    features: [
      'Unlimited patient bookings',
      'No MyTurnApp branding',
      'Full dashboard & queue management',
      'Booking QR code',
      'Booking history',
      'Email support',
    ],
    cta: 'Upgrade to Basic',
    featured: false,
    badge: null,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '₹1999',
    period: '/month',
    description: 'For clinics that want the complete experience',
    features: [
      'Everything in Basic',
      'SMS appointment reminders',
      'Advanced analytics dashboard',
      'Multi-doctor support',
      'Custom patient booking page',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    featured: true,
    badge: 'Most Popular',
  },
] as const;

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, handler: () => void): void;
    };
  }
}

export default function PricingPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<Plan>('free');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [loadingPlan, setLoadingPlan] = useState<'basic' | 'pro' | null>(null);
  const [rzpReady, setRzpReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return; }
      setDoctorEmail(user.email ?? '');
      supabase
        .from('doctors')
        .select('plan')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.plan) setCurrentPlan(data.plan as Plan);
        });
    });
  }, [router]);

  async function handleSubscribe(plan: 'basic' | 'pro') {
    if (currentPlan === plan) return;

    const razorpayLoaded = rzpReady || (typeof window !== 'undefined' && typeof window.Razorpay !== 'undefined');
    if (!razorpayLoaded) {
      toast.error('Payment system is still loading — please try again in a moment.');
      return;
    }

    setLoadingPlan(plan);

    let subscriptionId: string;
    try {
      const res = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        let msg = 'Failed to start checkout.';
        try { const b = await res.json(); if (b?.error) msg = b.error; } catch {}
        toast.error(msg);
        setLoadingPlan(null);
        return;
      }

      const data = await res.json();
      subscriptionId = data.subscription_id;
    } catch {
      toast.error('Could not reach server. Please check your connection.');
      setLoadingPlan(null);
      return;
    }

    const planLabel = plan === 'basic' ? 'Basic — ₹999/month' : 'Pro — ₹1999/month';

    const rzp = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      subscription_id: subscriptionId,
      name: 'MyTurnApp',
      description: planLabel,
      prefill: { email: doctorEmail },
      theme: { color: '#14A89E' },
      handler: () => {
        router.push('/dashboard?upgraded=1');
      },
      modal: {
        ondismiss: () => setLoadingPlan(null),
      },
    });

    rzp.on('payment.failed', () => {
      toast.error('Payment failed. Please try again.');
      setLoadingPlan(null);
    });

    rzp.open();
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setRzpReady(true)}
        onLoad={() => setRzpReady(true)}
      />

      <div className={styles.page}>
        {/* Topbar */}
        <div className={styles.topbar}>
          <div className={styles.brand}>MyTurnApp</div>
          <Link href="/dashboard" className={styles.backLink}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="14" height="14">
              <path d="M10 3L5 8l5 5"/>
            </svg>
            Back to dashboard
          </Link>
        </div>

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroLabel}>Pricing</div>
          <h1 className={styles.heroTitle}>Choose your plan</h1>
          <p className={styles.heroSub}>
            Upgrade anytime. No lock-in. Cancel from your Razorpay dashboard.
          </p>
          <div className={styles.currentPlanBadge}>
            Currently on: <strong>{PLAN_LABELS[currentPlan]}</strong>
          </div>
        </div>

        {/* Plan cards */}
        <div className={styles.cards}>
          {PLANS.map(p => {
            const isCurrent = currentPlan === p.id;
            const isLoading = loadingPlan === p.id;

            return (
              <div
                key={p.id}
                className={`${styles.card} ${p.featured ? styles.featured : ''}`}
              >
                {p.badge && <div className={styles.popularBadge}>{p.badge}</div>}
                {isCurrent && <div className={styles.currentBadge}>Current Plan</div>}

                <div className={styles.planName}>{p.name}</div>
                <div className={styles.planPrice}>
                  {p.price}<span className={styles.planPeriod}>{p.period}</span>
                </div>
                <div className={styles.planDesc}>{p.description}</div>

                <ul className={styles.featureList}>
                  {p.features.map(f => (
                    <li key={f} className={styles.featureItem}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="15" height="15">
                        <path d="M3 8l3.5 3.5L13 4"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  className={[
                    styles.ctaBtn,
                    p.featured && !isCurrent ? styles.primary : '',
                    isCurrent ? styles.currentPlan : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleSubscribe(p.id)}
                  disabled={isCurrent || isLoading !== false}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isLoading
                    ? 'Opening checkout…'
                    : p.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p>Payments are processed securely by Razorpay. Subscription renews monthly.</p>
          <p>
            Questions?{' '}
            <a href="mailto:support@myturnapp.online">support@myturnapp.online</a>
          </p>
        </div>
      </div>
    </>
  );
}
