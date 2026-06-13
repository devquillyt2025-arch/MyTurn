'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from '../auth.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase puts error_code in the URL hash when the link is invalid/expired
    if (window.location.hash.includes('error=')) {
      setInvalidLink(true);
      return;
    }

    const supabase = createClient();

    // PASSWORD_RECOVERY fires when Supabase processes the reset token from the hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // If the user refreshed the page, the session is already present
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  if (invalidLink) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.brand}>MyTurnApp</div>
          <h1 className={styles.heading}>Link expired</h1>
          <p className={styles.sub}>This password reset link is invalid or has expired.</p>
          <p className={styles.infoMsg}>Request a new link from the sign-in page.</p>
          <p className={styles.foot}>
            <Link href="/auth/login" className={styles.link}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Verifying reset link…
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.brand}>MyTurnApp</div>
          <h1 className={styles.heading}>Password updated</h1>
          <p className={styles.infoMsg}>Your password has been changed. Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>MyTurnApp</div>
        <h1 className={styles.heading}>Set new password</h1>
        <p className={styles.sub}>Choose a strong password for your account.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="newPassword">New password</label>
            <div className={styles.inputWrapper}>
              <input
                id="newPassword"
                className={styles.input}
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowNew(v => !v)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">Confirm password</label>
            <div className={styles.inputWrapper}>
              <input
                id="confirmPassword"
                className={styles.input}
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password →'}
          </button>
        </form>

        <p className={styles.foot}>
          <Link href="/auth/login" className={styles.link}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
