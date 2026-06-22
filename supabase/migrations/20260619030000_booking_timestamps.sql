-- Patient journey timestamps
--
-- assigned_at: moment the patient enters the active queue (token issued).
--   Walk-ins:    set at booking creation (same moment as checked_in_at).
--   Appointments: set at check-in (when token is issued), not at booking creation.
--   Null while an appointment is pre-booked but not yet checked in.
--
-- completed_at: moment the consultation is marked "Done".
--   Cleared back to NULL if status is ever reverted away from Done.
--
-- Backfill notes:
--   assigned_at  → COALESCE(checked_in_at, created_at) for all existing rows.
--   completed_at → created_at for existing 'done' rows. This is a placeholder
--                  only (real completion time was not recorded before this migration),
--                  so historical "Done · X min" durations will show 0.
--                  Flag: if you need accurate historical durations, you will need to
--                  populate these from application logs manually.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS assigned_at  timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill assigned_at for all existing rows.
UPDATE bookings
  SET assigned_at = COALESCE(checked_in_at, created_at)
  WHERE assigned_at IS NULL;

-- Backfill completed_at for existing done rows (placeholder — see note above).
UPDATE bookings
  SET completed_at = created_at
  WHERE status = 'done'
    AND completed_at IS NULL;

-- Speed up the patients-page query (order by assigned_at DESC within a clinic).
CREATE INDEX IF NOT EXISTS idx_bookings_assigned ON bookings (clinic_id, assigned_at DESC);
