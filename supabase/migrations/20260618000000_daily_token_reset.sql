-- Replace get_next_token with a day-scoped version so that token numbers
-- reset to #01 at the start of each calendar day (IST / Asia/Kolkata).
--
-- Previously the function returned MAX(token_number) + 1 across ALL bookings
-- for the clinic, meaning tokens kept incrementing indefinitely across days.
-- The new version scopes the MAX() to rows whose checked_in_at falls on
-- today's date in IST, so each day starts fresh at #01.
--
-- Concurrent-safety: because this is a plain SELECT (not an UPDATE of a
-- counter), two simultaneous calls can read the same MAX and both return the
-- same next value. The calling routes insert with this value, so the database
-- will raise a unique-constraint violation on the second insert if the
-- bookings.token_number column has a unique constraint per clinic per day.
-- If it does not, the calling code should be wrapped in a serialisable
-- transaction or advisory lock — acceptable for the current low-concurrency
-- clinic workload.

CREATE OR REPLACE FUNCTION get_next_token(p_clinic_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    MAX(token_number),
    0
  ) + 1
  FROM bookings
  WHERE clinic_id      = p_clinic_id
    AND token_number   IS NOT NULL
    AND (checked_in_at AT TIME ZONE 'Asia/Kolkata')::date
        = (NOW()        AT TIME ZONE 'Asia/Kolkata')::date;
$$;
