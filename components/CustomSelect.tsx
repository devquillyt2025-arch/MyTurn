'use client';

/**
 * CustomSelect — a fully themed replacement for native <select>.
 *
 * Uses a React portal so the open panel renders at document.body, which means
 * it's never clipped by modal overflow:hidden or z-index stacking contexts.
 *
 * Props:
 *   value          — controlled value
 *   onChange       — called with the new value string
 *   options        — { value, label }[]
 *   placeholder    — shown when value doesn't match any option (default "Select…")
 *   disabled
 *   style          — applied to the outer wrapper; use for width / height / fontSize
 *   triggerStyle   — overrides the trigger button's appearance (e.g. custom border/bg for tinted variants)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  style,
  triggerStyle,
}: CustomSelectProps) {
  const [open,       setOpen]       = useState(false);
  const [hovered,    setHovered]    = useState<string | null>(null);
  const [panelRect,  setPanelRect]  = useState({ top: 0, left: 0, minWidth: 0 });
  const [mounted,    setMounted]    = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find(o => o.value === value);

  // ── Open: compute panel position from trigger's viewport rect ──────────────
  const openPanel = useCallback(() => {
    if (!triggerRef.current || disabled) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPanelRect({ top: r.bottom + 4, left: r.left, minWidth: r.width });
    setOpen(true);
  }, [disabled]);

  // ── Close on outside mousedown ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const panel = (
    <div
      role="listbox"
      aria-label="Select option"
      style={{
        position:     'fixed',
        top:          panelRect.top,
        left:         panelRect.left,
        minWidth:     panelRect.minWidth,
        background:   'var(--surface)',
        border:       '1px solid var(--border2)',
        borderRadius: 8,
        boxShadow:    '0 12px 32px rgba(0,0,0,0.35)',
        zIndex:       99999,
        overflow:     'hidden',
        padding:      '4px 0',
      }}
    >
      {options.map(opt => {
        const isSel = opt.value === value;
        const isHov = hovered === opt.value;
        return (
          <div
            key={opt.value}
            role="option"
            aria-selected={isSel}
            onMouseEnter={() => setHovered(opt.value)}
            onMouseLeave={() => setHovered(null)}
            // mousedown fires before blur; preventDefault keeps focus on trigger
            onMouseDown={e => {
              e.preventDefault();
              onChange(opt.value);
              setOpen(false);
              setHovered(null);
            }}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:          8,
              padding:     '8px 14px',
              cursor:      'pointer',
              fontSize:    13,
              fontFamily:  'inherit',
              color:       isSel ? 'var(--teal)' : 'var(--text)',
              background:  isSel
                ? 'var(--teal-dim)'
                : isHov
                ? 'var(--surface2)'
                : 'transparent',
              transition:  'background 0.1s',
              userSelect:  'none',
            }}
          >
            {/* 16 px reserved so text aligns whether or not there's a checkmark */}
            <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {isSel && (
                <svg
                  width="12" height="12" viewBox="0 0 12 12"
                  fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                >
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </span>
            {opt.label}
          </div>
        );
      })}
    </div>
  );

  return (
    // Outer wrapper carries width / height / fontSize from caller
    <div style={{ position: 'relative', display: 'inline-flex', ...style }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        style={{
          // ── layout ──────────────────────────────────────────
          flex:            1,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:              6,
          padding:         '0 10px',
          // ── visual defaults (overridable via triggerStyle) ──
          background:      'var(--surface)',
          color:           'var(--text)',
          border:          `1px solid ${open ? 'var(--teal-border)' : 'var(--border2)'}`,
          borderRadius:    7,
          fontSize:        'inherit',
          fontFamily:      'inherit',
          textAlign:       'left',
          cursor:          disabled ? 'not-allowed' : 'pointer',
          opacity:         disabled ? 0.5 : 1,
          outline:         'none',
          transition:      'border-color 0.15s',
          whiteSpace:      'nowrap',
          overflow:        'hidden',
          // ── caller overrides (e.g. tinted role selector) ───
          ...triggerStyle,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          width="11" height="11" viewBox="0 0 12 12"
          fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
          aria-hidden="true"
          style={{
            flexShrink:  0,
            color:       'var(--muted)',
            transition:  'transform 0.15s',
            transform:   open ? 'rotate(180deg)' : 'none',
          }}
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {mounted && open && createPortal(panel, document.body)}
    </div>
  );
}
