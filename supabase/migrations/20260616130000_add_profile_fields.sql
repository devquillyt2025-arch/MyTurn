-- Profile page fields. NOTE: the spec referenced a `profiles` table; this
-- project stores doctor/clinic data in `clinics`. Clinic name/address already
-- exist as clinics.name / clinics.address, so only avatar_url, bio and
-- languages are new.

alter table clinics add column if not exists avatar_url text;
alter table clinics add column if not exists bio        text;
alter table clinics add column if not exists languages  text;  -- comma-separated

-- ── Avatar storage bucket (public read) ──────────────────────────────────
insert into storage.buckets (id, name, public)
values ('doctor-avatars', 'doctor-avatars', true)
on conflict (id) do nothing;

-- Storage RLS. Anyone can read (public avatars); a doctor may only write within
-- their own "{user_id}/..." folder. Re-runnable via drop-if-exists.
drop policy if exists "doctor-avatars public read"   on storage.objects;
drop policy if exists "doctor-avatars owner insert"  on storage.objects;
drop policy if exists "doctor-avatars owner update"  on storage.objects;
drop policy if exists "doctor-avatars owner delete"  on storage.objects;

create policy "doctor-avatars public read"
  on storage.objects for select
  using (bucket_id = 'doctor-avatars');

create policy "doctor-avatars owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "doctor-avatars owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "doctor-avatars owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'doctor-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
