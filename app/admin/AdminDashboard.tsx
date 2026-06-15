'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { updateDoctorPlan, deleteClinic } from './actions';
import styles from './admin.module.css';

const PLANS = ['free', 'basic', 'pro'] as const;
type Plan = (typeof PLANS)[number];

type Doctor = {
  id: string;
  doctor_name: string | null;
  clinic_name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  created_at: string;
};
type Clinic = {
  id: string;
  name: string | null;
  slug: string | null;
  max_patients: number | null;
  created_at: string;
};
type Booking = {
  id: string;
  patient_name: string | null;
  clinic_id: string | null;
  token_number: number | null;
  status: string | null;
  created_at: string;
};

type Props = {
  stats: { label: string; value: number }[];
  planCounts: Record<string, number>;
  doctors: Doctor[];
  clinics: Clinic[];
  recent: Booking[];
  clinicNames: Record<string, string>;
  loadError: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function AdminDashboard({ stats, planCounts, doctors, clinics, recent, clinicNames, loadError }: Props) {
  const [busy, setBusy] = useState(false);

  // Doctors filters
  const [docQuery, setDocQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | Plan>('all');
  const [planOverrides, setPlanOverrides] = useState<Record<string, string>>({});

  // Clinics
  const [clinicQuery, setClinicQuery] = useState('');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [confirmClinic, setConfirmClinic] = useState<Clinic | null>(null);

  const planOf = (d: Doctor) => (planOverrides[d.id] ?? d.plan ?? 'free').toLowerCase();

  async function changePlan(d: Doctor, plan: Plan) {
    const prev = planOf(d);
    if (prev === plan || busy) return;
    setPlanOverrides(o => ({ ...o, [d.id]: plan }));
    setBusy(true);
    const res = await updateDoctorPlan(d.id, plan);
    setBusy(false);
    if (!res.ok) {
      setPlanOverrides(o => ({ ...o, [d.id]: prev }));
      toast.error(res.error ?? 'Failed to change plan');
    } else {
      toast.success(`${d.doctor_name ?? 'Doctor'} → ${plan.toUpperCase()}`);
    }
  }

  async function confirmDelete(c: Clinic) {
    if (busy) return;
    setBusy(true);
    const res = await deleteClinic(c.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Failed to delete clinic');
    } else {
      setDeletedIds(s => new Set(s).add(c.id));
      toast.success(`Deleted ${c.name ?? 'clinic'}`);
    }
    setConfirmClinic(null);
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Booking link copied'),
      () => toast.error('Copy failed'),
    );
  }

  const dq = docQuery.trim().toLowerCase();
  const filteredDoctors = doctors.filter(d => {
    if (planFilter !== 'all' && planOf(d) !== planFilter) return false;
    if (!dq) return true;
    return [d.doctor_name, d.clinic_name, d.email, d.phone]
      .some(v => (v ?? '').toLowerCase().includes(dq));
  });

  const cq = clinicQuery.trim().toLowerCase();
  const filteredClinics = clinics.filter(c => {
    if (deletedIds.has(c.id)) return false;
    if (!cq) return true;
    return [c.name, c.slug].some(v => (v ?? '').toLowerCase().includes(cq));
  });

  const planOrder: Plan[] = ['free', 'basic', 'pro'];

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Platform overview</h1>
      <p className={styles.sub}>Manage all clinics, doctors, plans, and bookings across MyTurn.</p>

      {loadError && <div className={styles.errorBox}>Failed to load some data: {loadError}</div>}

      {/* Stat cards */}
      <section className={styles.statGrid}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statValue}>{s.value.toLocaleString('en-IN')}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Plan breakdown */}
      <section className={styles.planRow}>
        {planOrder.map(p => (
          <div key={p} className={styles.planChip}>
            <span className={`${styles.planDot} ${styles[`plan_${p}`] ?? ''}`} />
            <span className={styles.planName}>{p[0].toUpperCase() + p.slice(1)}</span>
            <span className={styles.planCount}>{planCounts[p] ?? 0}</span>
          </div>
        ))}
      </section>

      {/* Doctors */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Doctors</span>
          <span className={styles.cardCount}>{filteredDoctors.length}</span>
          <div className={styles.cardTools}>
            <select className={styles.select} value={planFilter}
              onChange={e => setPlanFilter(e.target.value as 'all' | Plan)}>
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
            <input className={styles.search} placeholder="Search doctors…"
              value={docQuery} onChange={e => setDocQuery(e.target.value)} />
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Doctor</th><th>Clinic</th><th>Email</th><th>Phone</th><th>Plan</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {filteredDoctors.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No doctors match</td></tr>
              ) : filteredDoctors.map(d => {
                const current = planOf(d);
                return (
                  <tr key={d.id}>
                    <td>{d.doctor_name ?? '—'}</td>
                    <td>{d.clinic_name ?? '—'}</td>
                    <td className={styles.mono}>{d.email ?? '—'}</td>
                    <td className={styles.mono}>{d.phone ?? '—'}</td>
                    <td>
                      <div className={styles.seg}>
                        {PLANS.map(p => (
                          <button key={p} type="button"
                            className={`${styles.segBtn} ${current === p ? `${styles.segActive} ${styles[`seg_${p}`] ?? ''}` : ''}`}
                            disabled={busy}
                            onClick={() => changePlan(d, p)}
                          >{p}</button>
                        ))}
                      </div>
                    </td>
                    <td className={styles.muted}>{fmtDate(d.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clinics */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Clinics</span>
          <span className={styles.cardCount}>{filteredClinics.length}</span>
          <div className={styles.cardTools}>
            <input className={styles.search} placeholder="Search clinics…"
              value={clinicQuery} onChange={e => setClinicQuery(e.target.value)} />
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Clinic</th><th>Booking link</th><th>Capacity</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {filteredClinics.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No clinics match</td></tr>
              ) : filteredClinics.map(c => (
                <tr key={c.id}>
                  <td>{c.name ?? '—'}</td>
                  <td>
                    {c.slug
                      ? <Link href={`/book/${c.slug}`} className={styles.link}>/book/{c.slug}</Link>
                      : <span className={styles.muted}>—</span>}
                  </td>
                  <td>{c.max_patients ?? '—'}</td>
                  <td className={styles.muted}>{fmtDate(c.created_at)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {c.slug && (
                        <button type="button" className={styles.ghostBtn}
                          onClick={() => copyLink(c.slug!)}>Copy link</button>
                      )}
                      <button type="button" className={styles.dangerBtn}
                        disabled={busy} onClick={() => setConfirmClinic(c)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent bookings */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Recent bookings</span>
          <span className={styles.cardCount}>{recent.length}</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Patient</th><th>Clinic</th><th>Token</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No bookings yet</td></tr>
              ) : recent.map(b => (
                <tr key={b.id}>
                  <td>{b.patient_name ?? '—'}</td>
                  <td>{clinicNames[b.clinic_id ?? ''] ?? '—'}</td>
                  <td className={styles.mono}>#{b.token_number ?? '—'}</td>
                  <td><span className={styles.statusBadge}>{b.status ?? '—'}</span></td>
                  <td className={styles.muted}>{fmtDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {confirmClinic && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setConfirmClinic(null); }}>
          <div className={styles.modalBox}>
            <div className={styles.modalTitle}>Delete clinic?</div>
            <p className={styles.modalText}>
              This permanently deletes <strong>{confirmClinic.name}</strong> and all of its bookings,
              slots, and usage logs. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirmClinic(null)}>Cancel</button>
              <button type="button" className={styles.dangerBtn} disabled={busy}
                onClick={() => confirmDelete(confirmClinic)}>
                {busy ? 'Deleting…' : 'Delete clinic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
