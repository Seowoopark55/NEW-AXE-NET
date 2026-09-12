# 1.47.7 AUTH MODAL + SESSION HOTFIX

## What changed
1. Auth modal portal: login/signup modal is mounted outside the sticky blurred topbar, so short browser windows and docked DevTools cannot clip the header/tabs.
2. Quiet session probe: an unauthenticated `validate` request returns `200 { ok: true, authenticated: false }` instead of an expected 401.
3. Protected actions unchanged: fund, shortcuts, assets, reactions and all other member-session actions still require a valid session.

## Deploy
Replace the NEW AXE NET project with this full source, commit/push, and let Vercel rebuild.
No SQL is required.
