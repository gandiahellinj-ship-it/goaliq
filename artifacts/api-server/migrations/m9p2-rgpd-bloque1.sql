-- ============================================================
-- MEJORA 9 PARTE 2 — RGPD BLOQUE 1: Setup BBDD
-- ============================================================

-- TABLA 1: consent_log — Tracking inmutable de consentimientos
CREATE TABLE IF NOT EXISTS consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'terms_of_use',
    'privacy_policy',
    'medical_data_processing',
    'ai_disclosure'
  )),
  consent_version TEXT NOT NULL DEFAULT 'v1.0',
  accepted BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user ON consent_log(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_log_created ON consent_log(created_at);

-- RLS: usuario solo ve sus propios consentimientos
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_consents"
  ON consent_log FOR SELECT
  USING (auth.uid() = user_id);

-- No DELETE policy = inmutable (solo service_role puede borrar)
-- No UPDATE policy = inmutable

COMMENT ON TABLE consent_log IS 'GDPR-compliant immutable log of user consents';

-- ============================================================

-- TABLA 2: beta_invite_codes — Códigos de invitación
CREATE TABLE IF NOT EXISTS beta_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_by_admin TEXT,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_codes_code ON beta_invite_codes(code) WHERE used_by_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_beta_codes_used ON beta_invite_codes(used_by_user_id);

-- RLS: solo service_role puede leer/escribir códigos
ALTER TABLE beta_invite_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE beta_invite_codes IS 'Beta program invitation codes';

-- ============================================================

-- COLUMNAS EXTRA en profiles para tracking compliance
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS medical_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_disclosure_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS beta_code_used TEXT,
  ADD COLUMN IF NOT EXISTS consent_version TEXT DEFAULT 'v1.0';

COMMENT ON COLUMN profiles.terms_accepted_at IS 'Timestamp of terms of use acceptance';
COMMENT ON COLUMN profiles.privacy_accepted_at IS 'Timestamp of privacy policy acceptance';
COMMENT ON COLUMN profiles.medical_consent_at IS 'Timestamp of GDPR Art. 9 medical data consent';
COMMENT ON COLUMN profiles.ai_disclosure_acknowledged_at IS 'Timestamp of AI processing disclosure acknowledgment';

-- ============================================================
-- FIN MIGRATION
-- ============================================================
