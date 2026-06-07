# API Smoke Tests

## Critical endpoints to validate

### POST /api/strength
**Test**: Send weight=20, reps=10, muscle_group="chest"
**Expected response**:
- Status 200
- Body: { log: {...}, isNewPR: false, prDelta: null, prevMax: null }

### GET /api/meals
**Test**: GET with valid auth
**Expected response**:
- Status 200 if plan exists
- Status 404 if no plan

### POST /api/account (DELETE)
**Test**: Delete test account
**Expected post-state**:
- auth.users row deleted
- deletion_logs +1 row with metadata
- beta_invite_codes used_at = NULL

[More endpoints]
