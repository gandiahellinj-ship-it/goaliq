INSERT INTO beta_invite_codes (code, created_by_admin, notes, expires_at)
VALUES
  ('GOALIQ-BETA-001', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-002', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-003', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-004', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-005', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-006', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-007', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-008', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-009', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days'),
  ('GOALIQ-BETA-010', 'jose', 'Beta inicial', NOW() + INTERVAL '90 days')
ON CONFLICT (code) DO NOTHING;
