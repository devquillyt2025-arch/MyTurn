'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';

const PLANS = ['free', 'basic', 'pro'] as const;
type ActionResult = { ok: boolean; error?: string };

/** Throws if the caller is not a signed-in admin. */
async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    throw new Error('Not authorized');
  }
}

export async function updateDoctorPlan(doctorId: string, plan: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!PLANS.includes(plan as (typeof PLANS)[number])) {
      return { ok: false, error: 'Invalid plan' };
    }
    const admin = createAdminClient();
    const { error } = await admin.from('doctors').update({ plan }).eq('id', doctorId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function deleteClinic(clinicId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    const admin = createAdminClient();
    // bookings/slots/usage_logs cascade via ON DELETE CASCADE in the schema.
    const { error } = await admin.from('clinics').delete().eq('id', clinicId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/admin');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed' };
  }
}
