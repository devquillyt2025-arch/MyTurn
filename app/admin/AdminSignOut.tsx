'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './admin.module.css';

export function AdminSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <button className={styles.signOut} onClick={handleSignOut} type="button">
      Sign out
    </button>
  );
}
