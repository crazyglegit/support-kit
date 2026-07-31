# AGENTS.md

## Repository Purpose

This repository contains an installable customer support kit.

It is NOT a standalone SaaS platform.

The objective is to build a reusable package that developers can install into existing applications with minimal setup.

The package should provide:

- Prebuilt customer chat widget
- Prebuilt agent dashboard
- Backend support API
- Real-time messaging
- AI writing assistance
- Chatbot
- Secure authentication adapters
- Database adapters
- Installation CLI

The first supported framework is Next.js App Router.

---

## Development Principles

- Always follow the architecture described in `docs/MASTER_BLUEPRINT.md`.
- Keep business logic framework-independent.
- Framework-specific implementations must be adapters.
- Prefer composition over inheritance.
- Do not tightly couple the core package to React or Next.js.
- Public APIs must remain stable.
- Keep packages modular and reusable.

---

## Code Standards

- TypeScript strict mode.
- Avoid `any`.
- Use Zod for runtime validation.
- Keep functions focused and composable.
- Prefer dependency injection over hardcoded services.
- Write self-documenting code.
- Minimize unnecessary dependencies.

---

## Security Rules

- Never trust client input.
- Validate all API requests.
- Enforce authorization server-side.
- Never expose internal notes to customers.
- Sanitize user-generated content.
- Protect against XSS, CSRF, and injection attacks.
- Treat AI output as untrusted input.

---

## Testing Requirements

Every feature must include appropriate tests.

Minimum expectations:

- Unit tests
- Integration tests
- Authorization tests
- End-to-end tests where applicable

Builds must pass before completing work.

---

## Documentation

Whenever public APIs, configuration, or installation changes:

- Update documentation.
- Keep examples working.
- Ensure installation instructions remain accurate.

---

## Before Completing Any Task

Verify:

- Project builds successfully.
- TypeScript passes.
- Lint passes.
- Tests pass.
- Documentation is updated if required.