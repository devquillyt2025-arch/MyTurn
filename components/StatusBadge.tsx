'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const DB_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: 'Waiting',    color: 'var(--amber)',              bg: 'rgba(245,166,35,0.12)'  },
  called:  { label: 'In session', color: 'var(--teal)',               bg: 'rgba(20,216,200,0.12)'  },
  done:    { label: 'Done',       color: 'var(--green)',              bg: 'rgba(77,255,180,0.12)'  },
  skipped: { label: 'No-show',    color: 'var(--red, #FF5E5E)',       bg: 'rgba(255,94,94,0.12)'   },
};

const OPTIONS = ['waiting', 'called', 'done', 'skipped'] as const;
type DbStatus = typeof OPTIONS[number];

interface StatusBadgeProps {
  dbStatus: string;
  onUpdate: (newDbStatus: string) => void | Promise<void>;
}

export function StatusBadge({ dbStatus, onUpdate }: StatusBadgeProps) {
  const [open, setOpen]       = useState(false);
  const [confirm, setConfirm] = useState<DbStatus | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const current = DB_STATUS_META[dbStatus] ?? DB_STATUS_META.waiting;

  function handleTriggerClick() {
    if (open) { setOpen(false); setConfirm(null); return; }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    setConfirm(null);
    setOpen(true);
  }

  function handleSelect(next: DbStatus) {
    if (next === dbStatus) { setOpen(false); return; }
    if (dbStatus === 'done') { setConfirm(next); return; }
    setOpen(false);
    onUpdate(next);
  }

  function handleConfirm() {
    if (!confirm) return;
    const target = confirm;
    setOpen(false);
    setConfirm(null);
    onUpdate(target);
  }

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setConfirm(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setConfirm(null); }
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const panel = open && mounted ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        minWidth: 165,
        padding: 5,
      }}
    >
      {confirm ? (
        // Confirmation step — only shown when reverting from Done.
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.55 }}>
            Patient was marked Done.<br />
            Change to <strong style={{ color: 'var(--text)' }}>{DB_STATUS_META[confirm]?.label}</strong>?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setConfirm(null)}
              style={{
                flex: 1, padding: '5px 0',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 7, color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1, padding: '5px 0',
                background: 'var(--teal-dim)', border: '1px solid var(--teal-border)',
                borderRadius: 7, color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >Confirm</button>
          </div>
        </div>
      ) : (
        OPTIONS.map(opt => {
          const meta = DB_STATUS_META[opt];
          const isCurrent = opt === dbStatus;
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 10px', gap: 8,
                borderRadius: 7, border: 'none',
                background: isCurrent ? 'var(--teal-dim)' : 'transparent',
                color: isCurrent ? 'var(--teal)' : meta.color,
                fontSize: 13, fontWeight: isCurrent ? 500 : 400,
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => {
                if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
              }}
              onMouseLeave={e => {
                if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: meta.color, flexShrink: 0, display: 'inline-block',
                }} />
                {meta.label}
              </span>
              {isCurrent && (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <path d="M2.5 8.5l3.5 3.5 7-7" />
                </svg>
              )}
            </button>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        title="Click to change status"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px 3px 10px',
          borderRadius: 20,
          border: `1px solid ${current.color}44`,
          background: current.bg,
          color: current.color,
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {current.label}
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.65 }}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {panel}
    </>
  );
}
