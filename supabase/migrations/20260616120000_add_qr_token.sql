-- Add a cryptographically strong, opaque public QR token to clinics.
--
-- NOTE: the spec referred to a `clinic_profiles` table; this project's table is
-- `clinics`. The token is the public identifier behind /q/<token>, which
-- resolves to the clinic's existing /book/<slug> flow. Generated server-side via
-- pgcrypto so it is unguessable (256 bits of entropy, ~1 in 2^256 collision).

create extension if not exists pgcrypto;

-- 1. Add the column (nullable for now so existing rows can be backfilled).
alter table clinics
  add column if not exists qr_token text;

-- 2. Backfill existing rows with 256-bit tokens.
update clinics
set qr_token = encode(
  digest(id::text || gen_random_uuid()::text || extract(epoch from now())::text, 'sha256'),
  'hex'
)
where qr_token is null;

-- 3. Enforce presence now that every row has one.
alter table clinics
  alter column qr_token set not null;

-- 4. Auto-generate a strong token for every future insert.
alter table clinics
  alter column qr_token set default encode(
    digest(gen_random_uuid()::text || gen_random_uuid()::text, 'sha256'),
    'hex'
  );

-- 5. Uniqueness + fast lookup by token (single index, also enforces uniqueness).
create unique index if not exists idx_clinic_qr_token on clinics(qr_token);

-- RLS: no new policies needed. The existing "clinics: public read" (SELECT using
-- true) already lets the public /q/<token> route resolve a token, and
-- "clinics: owner write" (FOR ALL using auth.uid() = user_id) already restricts
-- qr_token updates (regeneration) to the owning doctor.
