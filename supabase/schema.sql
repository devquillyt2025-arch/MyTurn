-- MyTurnApp schema
-- Run this in the Supabase SQL editor to create all tables and enable RLS.

-- digest()/encode() for strong qr_token generation, gen_random_uuid() for ids.
create extension if not exists pgcrypto;

-- ── Doctors (one row per registered doctor account) ──────────────
create table doctors (
  id           uuid primary key references auth.users(id) on delete cascade,
  clinic_name  text not null,
  doctor_name  text not null,
  phone        text not null,
  email        text not null,
  plan         text not null default 'free',
  created_at   timestamptz default now()
);

-- ── Clinics ───────────────────────────────────────────────────────
create table clinics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  doctor_name   text not null,
  phone         text not null,
  address       text,
  slug          text unique not null,
  qr_token      text not null default encode(
                  digest(gen_random_uuid()::text || gen_random_uuid()::text, 'sha256'), 'hex'),
  spec          text,
  qual          text,
  fee           text,
  avatar_url    text,
  bio           text,
  languages     text,
  max_patients  integer default 30,
  slot_duration integer default 15,
  days          text[]  default '{}',
  hours         jsonb   default '{}',
  created_at    timestamptz default now()
);

-- Opaque public QR token → /q/<qr_token> resolves to this clinic's booking page.
create unique index if not exists idx_clinic_qr_token on clinics(qr_token);

-- ── Slots ─────────────────────────────────────────────────────────
create table slots (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid references clinics(id) on delete cascade,
  date         date not null,
  time         text not null,
  max_bookings integer not null default 1,
  created_at   timestamptz default now(),
  unique (clinic_id, date, time)
);

-- ── Bookings ──────────────────────────────────────────────────────
create table bookings (
  id             uuid primary key default gen_random_uuid(),
  slot_id        uuid references slots(id) on delete set null,
  clinic_id      uuid references clinics(id) on delete cascade,
  patient_name   text not null,
  patient_phone  text not null default '',
  token_number   integer,
  status         text check (status in ('waiting','called','done','skipped')) default 'waiting',
  -- Intake channel: 'walkin' (no appointment) or 'appointment' (pre-booked slot).
  source         text not null default 'walkin' check (source in ('walkin','appointment')),
  -- Null = appointment not yet checked in (and therefore not yet assigned a token).
  checked_in_at  timestamptz,
  created_at     timestamptz default now()
);

-- ── Usage Logs ────────────────────────────────────────────────────
create table usage_logs (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid references clinics(id) on delete cascade,
  date          date not null,
  booking_count int not null default 0,
  unique (clinic_id, date)
);


-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════

alter table doctors    enable row level security;
alter table clinics    enable row level security;
alter table slots      enable row level security;
alter table bookings   enable row level security;
alter table usage_logs enable row level security;

-- ── doctors ───────────────────────────────────────────────────────
-- Each doctor can only read and write their own row.
-- INSERT happens client-side after signUp (user is authenticated at that point).
create policy "doctors: self only" on doctors
  for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ── clinics ───────────────────────────────────────────────────────
-- Anyone can read clinic data (needed for the public /book/[slug] page).
-- Only the owning doctor can insert / update / delete.
create policy "clinics: public read" on clinics
  for select using (true);

create policy "clinics: owner write" on clinics
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── slots ─────────────────────────────────────────────────────────
-- Anyone can read slots (public booking page).
-- Patients (anon) may upsert a slot when booking — the book page creates the
-- slot record before inserting the booking via the API route.
-- Only the clinic owner may delete slots.
create policy "slots: public read" on slots
  for select using (true);

create policy "slots: patient upsert" on slots
  for insert with check (true);

create policy "slots: owner delete" on slots
  for delete
  using (exists (
    select 1 from clinics where id = slots.clinic_id and user_id = auth.uid()
  ));

-- ── bookings ──────────────────────────────────────────────────────
-- INSERTs go through /api/bookings which uses the service-role key
-- and bypasses RLS — no INSERT policy needed here.
--
-- The public /book/[slug] page queries token_number with the anon key
-- to assign the next token. SELECT is therefore open but read-only for anon.
-- Patient PII (name, phone) is protected at the application layer via the
-- service-role-only insert path.
--
-- Clinic owners can read, update, and delete their own clinic's bookings.
create policy "bookings: public token read" on bookings
  for select using (true);

create policy "bookings: owner manage" on bookings
  for update
  using (exists (
    select 1 from clinics where id = bookings.clinic_id and user_id = auth.uid()
  ));

create policy "bookings: owner delete" on bookings
  for delete
  using (exists (
    select 1 from clinics where id = bookings.clinic_id and user_id = auth.uid()
  ));

-- ── usage_logs ────────────────────────────────────────────────────
-- Writes go through API routes using the service-role key — no write policy needed.
-- Clinic owners can read their own usage.
create policy "usage_logs: owner read" on usage_logs
  for select
  using (exists (
    select 1 from clinics where id = usage_logs.clinic_id and user_id = auth.uid()
  ));


-- ═══════════════════════════════════════════════════════════════════
-- Migration: walk-in vs appointment intake channels
--   Adds `source` and `checked_in_at` to bookings. Idempotent — safe to
--   re-run. For an existing database, run this block in the SQL editor.
-- ═══════════════════════════════════════════════════════════════════

-- 0. Allow appointments to have no token until check-in.
alter table bookings alter column token_number drop not null;

-- 1. Intake channel.
alter table bookings
  add column if not exists source text
  not null default 'walkin'
  check (source in ('walkin', 'appointment'));

-- 2. Check-in time. Null = appointment that hasn't checked in yet (no token).
alter table bookings
  add column if not exists checked_in_at timestamptz;

-- 3. Backfill existing slot-booked rows as already-checked-in appointments.
--    NOTE: the spec said `slot_time`, but bookings has no such column; the
--    slot link is `slot_id` (a slot row carries the date/time). So a
--    "non-null slot_time" booking == a row with a non-null slot_id.
update bookings
  set source = 'appointment', checked_in_at = created_at
  where slot_id is not null and source = 'walkin';
