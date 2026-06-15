import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { AdminSignOut } from './AdminSignOut';
import { AdminDashboard } from './AdminDashboard';
import styles from './admin.module.css';

// Always render fresh — this is an authenticated, data-heavy dashboard.
export const dynamic = 'force-dynamic';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function AdminPage() {
  // ── Gate: must be signed in AND on the admin allowlist ────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  // ── Fetch everything with the service-role client (bypasses RLS) ──────
  const admin = createAdminClient();
  const todayIso = new Date().toISOString().split('T')[0];

  const [
    doctorsRes, clinicsRes,
    totalBookingsRes, todayBookingsRes, weekBookingsRes, monthBookingsRes,
    recentRes,
  ] = await Promise.all([
    admin.from('doctors')
      .select('id, doctor_name, clinic_name, email, phone, plan, created_at')
      .order('created_at', { ascending: false }),
    admin.from('clinics')
      .select('id, name, slug, max_patients, created_at')
      .order('created_at', { ascending: false }),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true })
      .gte('created_at', `${todayIso}T00:00:00`),
    admin.from('bookings').select('id', { count: 'exact', head: true })
      .gte('created_at', isoDaysAgo(7)),
    admin.from('bookings').select('id', { count: 'exact', head: true })
      .gte('created_at', isoDaysAgo(30)),
    admin.from('bookings')
      .select('id, patient_name, clinic_id, token_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const doctors = doctorsRes.data ?? [];
  const clinics = clinicsRes.data ?? [];
  const recent  = recentRes.data ?? [];
  const totalBookings = totalBookingsRes.count ?? 0;
  const todayBookings = todayBookingsRes.count ?? 0;
  const weekBookings  = weekBookingsRes.count ?? 0;
  const monthBookings = monthBookingsRes.count ?? 0;

  const loadError =
    doctorsRes.error?.message ?? clinicsRes.error?.message ?? recentRes.error?.message ?? null;

  const planCounts = doctors.reduce<Record<string, number>>((acc, d) => {
    const p = (d.plan ?? 'free').toLowerCase();
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  const avgPerClinic = clinics.length ? Math.round(totalBookings / clinics.length) : 0;

  const stats = [
    { label: 'Doctors',          value: doctors.length },
    { label: 'Clinics',          value: clinics.length },
    { label: 'Bookings (all)',   value: totalBookings },
    { label: 'Bookings today',   value: todayBookings },
    { label: 'Last 7 days',      value: weekBookings },
    { label: 'Last 30 days',     value: monthBookings },
    { label: 'Avg / clinic',     value: avgPerClinic },
    { label: 'Paid plans',       value: (planCounts.basic ?? 0) + (planCounts.pro ?? 0) },
  ];

  const clinicNames: Record<string, string> =
    Object.fromEntries(clinics.map(c => [c.id, c.name ?? '—']));

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="MyTurn" className={styles.brandLogo} />
          <span className={styles.brandName}>My<span>Turn</span></span>
          <span className={styles.adminTag}>Admin</span>
        </div>
        <div className={styles.topbarRight}>
          <Link href="/dashboard" className={styles.topLink}>Dashboard ↗</Link>
          <span className={styles.adminEmail}>{user.email}</span>
          <AdminSignOut />
        </div>
      </header>

      <AdminDashboard
        stats={stats}
        planCounts={planCounts}
        doctors={doctors}
        clinics={clinics}
        recent={recent}
        clinicNames={clinicNames}
        loadError={loadError}
      />
    </div>
  );
}
