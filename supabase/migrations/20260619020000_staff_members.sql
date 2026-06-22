-- Phase 3: Staff / Team Members
--
-- Allows a clinic owner to invite receptionists, admins, or additional doctors
-- to their clinic. Invites are simulated (no real email is sent); the invited
-- user must sign up with the same email address to gain access.
--
-- Design decisions:
--   * (clinic_id, email) UNIQUE prevents double-inviting the same address.
--   * user_id is set once the invited user signs up and their account is linked.
--   * role drives sidebar restrictions on the dashboard (receptionist = limited view).
--   * status 'invited' means no user_id yet; 'active' = linked & able to log in.

CREATE TABLE staff_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        text        NOT NULL,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'receptionist'
              CHECK (role IN ('doctor', 'receptionist', 'admin')),
  status      text        NOT NULL DEFAULT 'invited'
              CHECK (status IN ('invited', 'active', 'disabled')),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  joined_at   timestamptz,
  UNIQUE (clinic_id, email)
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Clinic owner: full CRUD on their clinic's staff roster.
CREATE POLICY "staff_members: owner manage"
  ON staff_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM clinics WHERE id = staff_members.clinic_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clinics WHERE id = staff_members.clinic_id AND user_id = auth.uid()
  ));

-- Active staff: can read their own row (needed for role-based sidebar check).
CREATE POLICY "staff_members: self read"
  ON staff_members FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX idx_staff_clinic ON staff_members (clinic_id);
CREATE INDEX idx_staff_user   ON staff_members (user_id) WHERE user_id IS NOT NULL;
