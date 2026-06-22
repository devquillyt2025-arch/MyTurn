-- Phase 2: Notification Logs
--
-- Simulated notification delivery log. Every time a token is issued or an
-- appointment is confirmed, a row is inserted here so the doctor can see
-- what messages *would* be sent to patients once a real provider is connected.
--
-- Design decisions:
--   * booking_id is nullable (some notifications may not be tied to a booking).
--   * channel is 'sms' | 'whatsapp' — only 'sms' is auto-generated for now.
--   * status is always 'sent' for simulated entries (real failures tracked later).
--   * message_content stores the full text of the would-be message.

CREATE TABLE notifications_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  booking_id      uuid        REFERENCES bookings(id) ON DELETE SET NULL,
  patient_name    text        NOT NULL DEFAULT '',
  patient_phone   text        NOT NULL DEFAULT '',
  channel         text        NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  message_type    text        NOT NULL CHECK (message_type IN (
                                'token_issued',
                                'turn_approaching',
                                'appointment_reminder',
                                'appointment_confirmed'
                              )),
  message_content text        NOT NULL,
  status          text        NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- Only the clinic owner can read/write their notification log.
CREATE POLICY "notifications_log: clinic owner"
  ON notifications_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM clinics WHERE id = notifications_log.clinic_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clinics WHERE id = notifications_log.clinic_id AND user_id = auth.uid()
  ));

-- Primary query pattern: most-recent notifications for a clinic.
CREATE INDEX idx_notif_clinic  ON notifications_log (clinic_id, created_at DESC);
-- Allows fast lookup by booking (e.g. "has this booking been notified?").
CREATE INDEX idx_notif_booking ON notifications_log (booking_id) WHERE booking_id IS NOT NULL;
