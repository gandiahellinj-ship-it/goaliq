# GoalIQ Bug Hunter Skill

## Purpose
Detect bugs, regressions, and architectural inconsistencies in
GoalIQ automatically. This skill provides a structured way to
audit the application's health without relying on manual testing.

## When to use this skill
- Before a release (tag) → ensure no regressions
- After major changes → validate nothing broke
- When user reports unclear bug → systematic investigation
- Periodic audit (weekly recommended during beta)

## How to invoke
User commands recognized:
- "ejecuta bug hunt" → Full audit
- "validar schema" → Database health checks only
- "validar endpoints" → API smoke tests only
- "validar ui flows" → UI critical paths only
- "buscar regresiones" → Compare against last tag

## Skill methodology
1. Read architecture.md to understand the system
2. Read known-bugs.md to learn from past bugs
3. Read patterns.md to detect recurring patterns
4. Execute checks/ in the requested order
5. Generate structured report with priorities
6. Suggest specific fixes for detected issues

## Output format
Always provide structured report:
```
┌─ GoalIQ Bug Hunt Report - [DATE] ─────────────┐
│ Schema health: [status]                       │
│ API smoke tests: [status]                     │
│ UI flows: [status]                            │
│ Known regressions: [count]                    │
│                                               │
│ DETECTED ISSUES:                              │
│ 🔴 CRITICAL: [list]                          │
│ 🟡 MEDIUM: [list]                            │
│ 🟢 LOW: [list]                               │
│                                               │
│ NEXT ACTIONS:                                 │
│ 1. [fix suggestion + estimate]                │
│ 2. ...                                        │
└───────────────────────────────────────────────┘
```

## Update policy
This skill must be updated whenever:
- New bug pattern discovered → add to patterns.md
- Schema changes → update architecture.md
- New endpoint critical → add to checks/endpoints.md
- Historical bug resolved → log in known-bugs.md
