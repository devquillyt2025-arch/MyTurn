'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

type QStatus = 'done' | 'current' | 'waiting' | 'skipped';
interface QItem { token: number; name: string; age: number; time: string; status: QStatus; }

function tok(n: number) { return String(n).padStart(2, '0'); }

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hlHtml(text: string, q: string) {
  const safe = escHtml(text);
  if (!q) return safe;
  const idx = safe.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return safe;
  return safe.slice(0, idx) + `<mark class="hl">${safe.slice(idx, idx + q.length)}</mark>` + safe.slice(idx + q.length);
}

export default function PatientsPage() {
  const [queue, setQueue] = useState<QItem[]>([]);
  const [clinicId, setClinicId] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('clinics')
        .select('id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setClinicId(data.id);
          supabase
            .from('bookings')
            .select('token_number, patient_name, status')
            .eq('clinic_id', data.id)
            .then(({ data: bookings }) => {
              if (!bookings) return;
              setQueue(bookings.map(b => ({
                token: b.token_number,
                name: b.patient_name || 'Unknown Patient',
                age: 0,
                time: '—',
                status: 'waiting' as QStatus,
              })));
            });
        });
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddPatientOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function addPatient() {
    if (!newName.trim()) return;
    const nextToken = Math.max(...queue.map(p => p.token), 0) + 1;
    const timeStr = newTime.trim() || '—';
    const entry: QItem = { token: nextToken, name: newName.trim(), age: parseInt(newAge) || 0, time: timeStr, status: 'waiting' };
    setQueue(prev => [...prev, entry]);
    if (clinicId) {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: null,
          clinic_id: clinicId,
          patient_name: entry.name,
          patient_phone: '',
          token_number: nextToken,
        }),
      });
    }
    toast.success(`${entry.name} added`);
    setNewName(''); setNewAge(''); setNewTime('');
    setAddPatientOpen(false);
  }

  const filteredPatients = queue.filter(p =>
    p.name.toLowerCase().includes(patientFilter.toLowerCase()) ||
    String(p.token).includes(patientFilter)
  );

  return (
    <div className={styles.routePage}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Patients</div>
          <div className={styles.pageSub}>All registered patients · {queue.length} total today</div>
        </div>
        <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => setAddPatientOpen(true)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15"><path d="M8 2v12M2 8h12"/></svg>
          Add patient
        </button>
      </div>

      <div className={styles.searchBar}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>
        <input
          type="text"
          placeholder="Search by name, token or phone…"
          value={patientFilter}
          onChange={e => setPatientFilter(e.target.value)}
        />
      </div>

      <div className={styles.card}>
        <div className={`${styles.patientRow} ${styles.header}`}>
          <div></div><div>Name</div><div>Age</div><div>Time</div><div>Status</div>
        </div>
        {filteredPatients.map(p => {
          const initials = p.name.split(' ').map(w => w[0]).slice(0,2).join('');
          const statusColor = { done: 'var(--green)', current: 'var(--teal)', waiting: 'var(--amber)', skipped: 'var(--red)' }[p.status];
          const statusLabel = { done: 'Done', current: 'In session', waiting: 'Waiting', skipped: 'Skipped' }[p.status];
          const tokenStr = `Token #${tok(p.token)}`;
          return (
            <div key={p.token} className={styles.patientRow}>
              <div className={styles.patientAvatar}>{initials}</div>
              <div>
                <div style={{fontWeight:500}} dangerouslySetInnerHTML={{__html: hlHtml(p.name, patientFilter)}} />
                <div style={{fontSize:12,color:'var(--muted)'}} dangerouslySetInnerHTML={{__html: hlHtml(tokenStr, patientFilter)}} />
              </div>
              <div style={{color:'var(--muted)'}}>{p.age} yrs</div>
              <div style={{color:'var(--muted)'}}>{p.time}</div>
              <div style={{color:statusColor,fontSize:12,fontWeight:500}}>{statusLabel}</div>
            </div>
          );
        })}
      </div>

      {/* Add Patient Modal */}
      <div className={`${styles.modalOverlay} ${addPatientOpen ? styles.open : ''}`} onClick={e => { if (e.target === e.currentTarget) setAddPatientOpen(false); }}>
        <div className={styles.modalBox} style={{width: 420, textAlign: 'left'}}>
          <button className={styles.modalClose} onClick={() => setAddPatientOpen(false)}>✕</button>
          <div className={styles.modalTitle}>Add Patient</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Full name <span style={{color:'var(--red)'}}>*</span></div></div>
              <input className={styles.settingsInput} placeholder="e.g. Arjun Sharma" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPatient()} style={{width: 200}} autoFocus />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Age</div></div>
              <input className={styles.settingsInput} type="number" placeholder="e.g. 35" min={1} max={110} value={newAge} onChange={e => setNewAge(e.target.value)} style={{width: 100, textAlign: 'center'}} />
            </div>
            <div className={styles.settingsRow} style={{border: 'none', padding: 0}}>
              <div><div className={styles.settingsRowLabel}>Time slot</div><div className={styles.settingsRowSub}>Walk-in time or booked slot</div></div>
              <input className={styles.settingsInput} placeholder="e.g. 11:30 AM" value={newTime} onChange={e => setNewTime(e.target.value)} style={{width: 140}} />
            </div>
          </div>
          <div style={{marginTop: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)'}}>
            Token <strong style={{color: 'var(--text)'}}>#{String(Math.max(...queue.map(p => p.token), 0) + 1).padStart(2,'0')}</strong> will be assigned · Status: Waiting
          </div>
          <div style={{display: 'flex', gap: 8, marginTop: 20}}>
            <button className={styles.actionBtn} style={{flex: 1, justifyContent: 'center'}} onClick={() => { setAddPatientOpen(false); setNewName(''); setNewAge(''); setNewTime(''); }}>Cancel</button>
            <button className={`${styles.actionBtn} ${styles.primary}`} style={{flex: 1, justifyContent: 'center'}} onClick={addPatient} disabled={!newName.trim()}>Add to queue</button>
          </div>
        </div>
      </div>
    </div>
  );
}
