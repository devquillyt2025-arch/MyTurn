-- Phase 1: Billing & Invoices
--
-- Creates the `invoices` table, which is auto-populated whenever a doctor
-- marks a patient as "done" (token completion). The doctor then manually
-- records the payment method via the Billing page.
--
-- Design decisions:
--   * booking_id is UNIQUE so a completion event never creates a duplicate invoice.
--   * amount and consultation_fee are separate: fee is the clinic's standard rate,
--     amount is what was actually charged (may differ for discounts/waivers).
--   * payment_method is nullable until the doctor records it.
--   * razorpay_payment_id is reserved for future online-payment integration.

CREATE TABLE invoices (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid          NOT NULL REFERENCES clinics(id)  ON DELETE CASCADE,
  booking_id          uuid          UNIQUE       REFERENCES bookings(id) ON DELETE SET NULL,
  patient_name        text          NOT NULL,
  amount              numeric(10,2) NOT NULL DEFAULT 0,
  consultation_fee    numeric(10,2) NOT NULL DEFAULT 0,
  status              text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('paid', 'pending', 'refunded')),
  payment_method      text          CHECK (payment_method IN ('cash', 'upi', 'razorpay')),
  razorpay_payment_id text,
  visit_date          date          NOT NULL,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Only the clinic owner (doctor) can read/write their own clinic's invoices.
-- Matches the same pattern used by slots and usage_logs.
CREATE POLICY "invoices: clinic owner"
  ON invoices
  FOR ALL
  USING  (EXISTS (
    SELECT 1 FROM clinics WHERE id = invoices.clinic_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM clinics WHERE id = invoices.clinic_id AND user_id = auth.uid()
  ));

-- Fast per-clinic date-range queries (used by Billing page and stats row).
CREATE INDEX idx_invoices_clinic_visit ON invoices (clinic_id, visit_date DESC);
-- Fast lookup by booking (used by the duplicate-prevention check in the API).
CREATE INDEX idx_invoices_booking     ON invoices (booking_id) WHERE booking_id IS NOT NULL;
