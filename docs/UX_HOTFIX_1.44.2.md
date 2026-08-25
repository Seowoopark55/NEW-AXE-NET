# AXE NET UX HOTFIX 1.44.2

## Scope
Console-noise cleanup only. No database schema change.

### Outlaw media fallback
Known legacy guide-step image filenames that are not present in `public/assets/outlaw/`
are now rendered as a local fallback without issuing broken image requests.

### Fund fee-rule duplicate guard
Submitting a fee rule that is already active for the same period is treated as a no-op
with a user-facing message. Conflicting active rules for the same period are explained
before the RPC call.

### Validation
Run:
- `npm.cmd run audit:styles`
- `npm.cmd run audit:ux`
- `npm.cmd run build`
