'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateQRToken } from '@/lib/qr';

type RegenResult = { ok: boolean; token?: string; error?: string };

/**
 * Regenerates the calling doctor's clinic QR token. Server-side so the strong
 * Node-crypto generation never reaches the client. Ownership is enforced both
 * by the `clinics: owner write` RLS policy and the explicit user_id match below.
 * Any QR previously printed/shared stops working once this succeeds.
 */
export async function regenerateQrToken(clinicId: string): Promise<RegenResult> {
  try {
    if (!clinicId) return { ok: false, error: 'Missing clinic id' };
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in' };

    const token = generateQRToken(clinicId);
    const { data, error } = await supabase
      .from('clinics')
      .update({ qr_token: token })
      .eq('id', clinicId)
      .eq('user_id', user.id)
      .select('qr_token')
      .single();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Clinic not found' };

    revalidatePath('/dashboard/settings');
    return { ok: true, token: data.qr_token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to regenerate' };
  }
}
