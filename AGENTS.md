# AGENTS.md

Blog for a developer.

Site structure, scope, and the definition of done live in `docs/end-state.md`.
Read it before making product-shaping changes; keep it authoritative rather than
restating it here.

## Environment

- Build command: TBD
- Test command: TBD
- CI/CD production release on merge:
- Free cloudflare workers or GitHub pages
- Frameworks: computer use (or playwright, agent-browser), pnpm

## Design stance

- Keep a module stay single-purpose; ~800 LOC is a guideline, not a hard cap.
- Static site.

## Working agreement

- Verify external APIs usage against current docs (context7 MCP).
- For high-risk work, use at least two independent, decorrelated review lenses—different models
  or reviewer perspectives. Keep findings separate until both reviews finish, then
  reconcile material disagreements before acting.
- Split work when a non-mechanical change would exceed roughly 2,000 changed lines, or 1,000
  lines of complex logic excluding tests. Split along real dependencies, not line counts.
