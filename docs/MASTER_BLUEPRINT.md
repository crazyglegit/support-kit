# Drop-In Customer Support Kit
## Refined Product and Engineering Blueprint

**Status:** Build-ready  
**Primary goal:** Create one reusable customer-support codebase that can be installed into existing projects with minimal frontend and backend work.  
**Initial distribution:** Private GitHub repository published through GitHub Packages.  
**First supported host:** Next.js App Router.  
**Initial database:** PostgreSQL with Drizzle ORM.  
**Initial realtime transport:** Socket.IO adapter.  
**Primary language:** TypeScript.

---

# 1. Product Definition

Build a reusable, self-hosted customer-support package that existing applications can install and use as a native part of the product.

The package must provide:

- A complete customer-facing chat widget.
- A complete agent and admin dashboard.
- Support API handlers.
- Database schema and migrations.
- Realtime messaging.
- Customer and agent authentication adapters.
- Conversation management.
- Agent assignment.
- Internal notes.
- Attachments.
- Saved replies.
- Basic knowledge-base chatbot.
- AI-assisted writing tools.
- Installation CLI.
- Example application.
- Automated package and installation tests.

The host application should only need to provide:

- Its existing user authentication.
- Its database connection.
- Environment variables.
- Optional storage, email and AI provider credentials.
- A route where the support dashboard is mounted.

The host application should not need to design or build the chat widget, conversation inbox, message composer, customer panel, chatbot interface, loading states, empty states or responsive layouts.

---

# 2. Product Positioning

This project is:

> A self-hosted, installable customer-support SDK with finished frontend components and backend functionality.

It is not initially:

- A multi-company customer-support SaaS.
- A subscription platform.
- A headless API requiring every project to build its own interface.
- A standalone support product hosted separately from the main project.
- A microservices platform.

A hosted SaaS version may be developed later, but the first version must optimize for installation into the developer's own projects.

---

# 3. Success Criterion

A developer should be able to add the support system to an existing Next.js project using roughly:

```bash
pnpm add @OWNER/support
pnpm support init
pnpm support migrate
```

Then add the customer widget:

```tsx
import { SupportWidget } from "@OWNER/support/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SupportWidget />
      </body>
    </html>
  );
}
```

And add the agent dashboard:

```tsx
import { SupportDashboard } from "@OWNER/support/react";

export default function SupportPage() {
  return <SupportDashboard />;
}
```

The package should generate or document the API route and configuration required to make these components work.

If installation requires significant custom frontend work, the product has failed its main objective.

---

# 4. Recommended Technology Stack

## Repository and releases

- pnpm workspaces.
- Turborepo.
- Changesets.
- GitHub Actions.
- GitHub Packages.
- TypeScript strict mode.

## Frontend

- React.
- Vite for package and widget builds.
- Tailwind CSS.
- Radix UI primitives.
- TanStack Query for server state.
- Zustand for limited local interface state.
- React Hook Form.
- Zod.

## First host integration

- Next.js App Router.
- Next.js Route Handlers.

## Backend

- Framework-independent TypeScript core.
- Next.js server adapter.
- Zod request and event validation.
- Structured errors.
- Pino-compatible logging interface.

## Database

- PostgreSQL.
- Drizzle ORM as the first database adapter.
- SQL migrations generated and versioned by the package.

## Realtime

- Socket.IO adapter.
- Durable message persistence through the core service.
- Realtime events treated as notifications, not as the source of truth.
- Reconnection and message resynchronization.

## Attachments

- S3-compatible object storage adapter.
- Local development storage adapter.
- Private objects and authorized download URLs.

## AI

- Provider-independent AI interface.
- OpenAI adapter as the first implementation.
- AI functions remain optional.

## Testing

- Vitest.
- Playwright.
- Docker or Testcontainers for PostgreSQL integration tests.
- Installation tests against a fresh example application.

---

# 5. Repository Structure

```text
support-kit/
├── packages/
│   ├── core/
│   ├── contracts/
│   ├── db-drizzle/
│   ├── server-nextjs/
│   ├── realtime-socketio/
│   ├── react/
│   ├── widget/
│   ├── dashboard/
│   ├── ai/
│   ├── storage-s3/
│   ├── notifications/
│   ├── cli/
│   └── support/
│
├── examples/
│   └── nextjs-demo/
│
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── integration/
│   ├── api/
│   ├── security/
│   └── testing/
│
├── tests/
│   ├── integration/
│   ├── installation/
│   ├── security/
│   └── e2e/
│
├── .github/
│   └── workflows/
│
├── AGENTS.md
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

# 6. Package Responsibilities

## 6.1 `@OWNER/support-core`

Framework-independent domain and business logic.

Responsibilities:

- Customers.
- Agents.
- Conversations.
- Messages.
- Conversation state transitions.
- Assignment.
- Internal notes.
- Saved replies.
- Permission evaluation.
- Audit events.
- Chatbot handoff.
- Service interfaces.
- Repository interfaces.
- Domain errors.

Rules:

- Must not import Next.js.
- Must not import React.
- Must not depend directly on Drizzle.
- Must not contain browser code.
- Must remain testable without a running web server.

## 6.2 `@OWNER/support-contracts`

Shared contracts used across frontend and backend.

Contains:

- Zod schemas.
- TypeScript types.
- API request schemas.
- API response schemas.
- Socket event schemas.
- Error codes.
- Permission names.
- Message types.
- Conversation statuses.
- Configuration schemas.

The frontend and backend must use the same contract definitions.

## 6.3 `@OWNER/support-db-drizzle`

PostgreSQL and Drizzle implementation.

Contains:

- Drizzle schema.
- Repository implementations.
- SQL migrations.
- Migration runner.
- Transaction adapter.
- Test database helpers.
- Database health checks.

The host application's existing database remains its main database. Support tables are added to that database with a `support_` prefix.

## 6.4 `@OWNER/support-nextjs`

Next.js App Router integration.

Contains:

- Route Handler factory.
- Request conversion.
- Cookie and session helpers.
- Server-side configuration loading.
- Dashboard route integration helpers.
- Widget session handlers.
- Next.js-specific errors.

Example:

```ts
import { createSupportHandler } from "@OWNER/support/nextjs";
import supportConfig from "@/support.config";

export const { GET, POST, PATCH, DELETE } =
  createSupportHandler(supportConfig);
```

## 6.5 `@OWNER/support-realtime-socketio`

Contains:

- Socket server setup.
- Connection authentication.
- Conversation room authorization.
- Message events.
- Typing events.
- Presence events.
- Read receipts.
- Reconnection support.
- Optional Redis scaling adapter.

Realtime transport must be accessed through a core interface so another implementation can be added later.

## 6.6 `@OWNER/support-react`

Public React integration package.

Exports:

- `SupportProvider`.
- `SupportWidget`.
- `SupportDashboard`.
- `SupportInbox`.
- `SupportConversation`.
- `SupportCustomerPanel`.
- Support hooks.
- Theme provider.
- Component override types.

## 6.7 `@OWNER/support-widget`

Customer-facing interface.

Includes:

- Chat launcher.
- Welcome screen.
- New conversation form.
- Conversation list.
- Active conversation view.
- Message composer.
- Typing state.
- Attachments.
- Offline state.
- Bot state.
- Waiting-for-agent state.
- Resolution state.
- Customer rating.
- Mobile full-screen behavior.

The widget may render directly inside React applications and may also support an iframe build for non-React hosts later.

## 6.8 `@OWNER/support-dashboard`

Complete agent interface.

Includes:

- Conversation inbox.
- Assigned and unassigned filters.
- Conversation timeline.
- Customer information panel.
- Assignment controls.
- Internal notes.
- Saved replies.
- Search.
- Status changes.
- Attachment handling.
- AI writing controls.
- Knowledge-base management.
- Basic settings.

## 6.9 `@OWNER/support-ai`

Contains:

- AI provider interface.
- OpenAI adapter.
- Prompt templates.
- Input redaction.
- Output validation.
- Usage limits.
- Failure handling.

## 6.10 `@OWNER/support-cli`

Provides:

```bash
pnpm support init
pnpm support migrate
pnpm support seed
pnpm support doctor
pnpm support generate
```

## 6.11 `@OWNER/support`

The main package installed by consumers.

It should provide a small, stable public API and re-export only supported integration surfaces.

---

# 7. Public Package API

Keep the public API intentionally small.

```ts
// Configuration
export { defineSupportConfig } from "@OWNER/support";

// React
export {
  SupportProvider,
  SupportWidget,
  SupportDashboard,
  SupportInbox,
  SupportConversation,
} from "@OWNER/support/react";

// Next.js
export {
  createSupportHandler,
  createSupportServer,
} from "@OWNER/support/nextjs";

// Database
export {
  createDrizzleSupportAdapter,
  runSupportMigrations,
} from "@OWNER/support/database";

// Realtime
export {
  createSocketIOSupportAdapter,
} from "@OWNER/support/realtime";

// Optional integrations
export {
  createS3StorageAdapter,
  createOpenAIAdapter,
  createResendNotificationAdapter,
} from "@OWNER/support/adapters";
```

Do not expose internal repositories, internal service classes or unstable implementation details.

---

# 8. Installation Experience

## 8.1 Install

```bash
pnpm add @OWNER/support
```

## 8.2 Initialize

```bash
pnpm support init
```

The CLI should ask:

```text
Framework: Next.js App Router
Database: PostgreSQL with Drizzle
API route: /api/support
Dashboard route: /admin/support
Enable attachments: Yes
Enable chatbot: Yes
Enable AI writing tools: Yes
```

The CLI generates:

```text
support.config.ts
app/api/support/[...support]/route.ts
app/admin/support/page.tsx
components/support-widget.tsx
support/schema.ts
support/migrations/
.env.support.example
```

## 8.3 Run migrations

```bash
pnpm support migrate
```

## 8.4 Mount customer widget

```tsx
import { SupportWidget } from "@OWNER/support/react";

export function AppSupportWidget() {
  return <SupportWidget />;
}
```

## 8.5 Mount agent dashboard

```tsx
import { SupportDashboard } from "@OWNER/support/react";

export default function SupportAdminPage() {
  return <SupportDashboard />;
}
```

## 8.6 Verify setup

```bash
pnpm support doctor
```

The doctor command should verify:

- Environment variables.
- Database connectivity.
- Required support tables.
- API route.
- Dashboard route.
- Customer authentication adapter.
- Agent authentication adapter.
- Realtime configuration.
- Storage configuration.
- AI configuration when enabled.

---

# 9. Host Application Configuration

Example:

```ts
import {
  defineSupportConfig,
  createDrizzleSupportAdapter,
  createSocketIOSupportAdapter,
  createOpenAIAdapter,
} from "@OWNER/support";

import { db } from "@/server/database";
import { getCurrentUser } from "@/server/auth";

export default defineSupportConfig({
  projectId: "main-app",

  database: createDrizzleSupportAdapter({ db }),

  auth: {
    async getCustomer(request) {
      const user = await getCurrentUser(request);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        metadata: {
          plan: user.plan,
        },
      };
    },

    async getAgent(request) {
      const user = await getCurrentUser(request);

      if (!user || !["admin", "support"].includes(user.role)) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        permissions:
          user.role === "admin"
            ? ["support:*"]
            : [
                "conversation:read",
                "conversation:reply",
                "conversation:assign",
                "internal-note:create",
              ],
      };
    },
  },

  realtime: createSocketIOSupportAdapter(),

  widget: {
    position: "bottom-right",
    theme: "system",
    accentColor: "#111827",
    greeting: "How can we help?",
    allowAttachments: true,
    allowAnonymousVisitors: true,
  },

  ai: {
    enabled: true,
    adapter: createOpenAIAdapter({
      apiKey: process.env.OPENAI_API_KEY!,
    }),
  },
});
```

---

# 10. Adapter Interfaces

## 10.1 Authentication adapter

```ts
export interface SupportAuthAdapter {
  getCustomer(
    request: Request,
  ): Promise<SupportCustomerIdentity | null>;

  getAgent(
    request: Request,
  ): Promise<SupportAgentIdentity | null>;
}
```

```ts
export interface SupportCustomerIdentity {
  id: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}
```

```ts
export interface SupportAgentIdentity {
  id: string;
  name: string;
  email?: string;
  permissions: SupportPermission[];
}
```

## 10.2 Database adapter

```ts
export interface SupportDatabaseAdapter {
  customers: SupportCustomerRepository;
  agents: SupportAgentRepository;
  conversations: SupportConversationRepository;
  messages: SupportMessageRepository;
  attachments: SupportAttachmentRepository;
  savedReplies: SupportSavedReplyRepository;
  knowledge: SupportKnowledgeRepository;
  audit: SupportAuditRepository;

  transaction<T>(
    callback: (transaction: SupportDatabaseAdapter) => Promise<T>,
  ): Promise<T>;
}
```

## 10.3 Realtime adapter

```ts
export interface SupportRealtimeAdapter {
  publish(
    channel: string,
    event: SupportRealtimeEvent,
  ): Promise<void>;

  authorize(
    actor: SupportActor,
    channel: string,
  ): Promise<boolean>;

  disconnectSession?(sessionId: string): Promise<void>;
}
```

## 10.4 Storage adapter

```ts
export interface SupportStorageAdapter {
  createUpload(input: CreateUploadInput): Promise<UploadTarget>;
  completeUpload(uploadId: string): Promise<StoredAttachment>;
  createDownloadUrl(fileId: string): Promise<string>;
  deleteFile(fileId: string): Promise<void>;
}
```

## 10.5 AI adapter

```ts
export interface SupportAIAdapter {
  rewrite(input: RewriteInput): Promise<RewriteResult>;
  suggestReply(input: SuggestReplyInput): Promise<SuggestReplyResult>;
  summarize(input: SummaryInput): Promise<SummaryResult>;
  answerFromKnowledge(
    input: KnowledgeAnswerInput,
  ): Promise<KnowledgeAnswerResult>;
}
```

## 10.6 Notification adapter

```ts
export interface SupportNotificationAdapter {
  notifyAgent(input: AgentNotification): Promise<void>;
  notifyCustomer(input: CustomerNotification): Promise<void>;
}
```

---

# 11. Database Schema

Use a `support_` prefix to avoid collisions with host tables.

Required tables:

```text
support_projects
support_agents
support_customers
support_customer_sessions
support_conversations
support_conversation_participants
support_conversation_assignments
support_messages
support_message_receipts
support_attachments
support_tags
support_conversation_tags
support_saved_replies
support_knowledge_articles
support_bot_sessions
support_ratings
support_audit_logs
```

Every support-owned record must contain:

```text
project_id
created_at
updated_at
```

Use references to host identities:

```text
external_customer_id
external_agent_id
```

Do not duplicate the host application's complete user table.

## 11.1 Conversation statuses

```text
open
waiting_for_agent
waiting_for_customer
resolved
closed
spam
```

## 11.2 Message types

```text
text
image
file
bot
system
internal_note
quick_reply
```

## 11.3 Sender types

```text
customer
visitor
agent
bot
system
```

## 11.4 Delivery states

```text
pending
sent
delivered
read
failed
```

## 11.5 Idempotency

Every client-created message must include a unique `client_message_id`.

Retries with the same identity must return the original message instead of creating another message.

---

# 12. Customer Widget Requirements

The customer widget must be production-ready and prebuilt.

## Required views

- Launcher.
- Welcome screen.
- Conversation list.
- New conversation.
- Active conversation.
- Bot conversation.
- Waiting-for-agent state.
- Offline contact form.
- Resolved state.
- Satisfaction rating.

## Required behavior

- Anonymous visitor support.
- Authenticated customer support.
- Text messages.
- Attachments.
- Typing indicators.
- Read receipts.
- Reconnection.
- Conversation history.
- Draft preservation.
- Failed-message retry.
- Duplicate prevention.
- Responsive layout.
- Keyboard navigation.
- Screen-reader labels.
- Reduced-motion support.
- Mobile full-screen mode.

## Configuration

```ts
export interface SupportWidgetConfig {
  position?: "bottom-left" | "bottom-right";
  theme?: "light" | "dark" | "system";
  accentColor?: string;
  greeting?: string;
  launcherLabel?: string;
  locale?: string;
  allowAttachments?: boolean;
  allowAnonymousVisitors?: boolean;
  showKnowledgeSearch?: boolean;
}
```

## Styling

Expose CSS variables:

```css
:root {
  --support-primary: #111827;
  --support-background: #ffffff;
  --support-text: #111827;
  --support-muted: #6b7280;
  --support-border: #e5e7eb;
  --support-radius: 16px;
  --support-font: Inter, sans-serif;
}
```

Also allow advanced component overrides:

```tsx
<SupportWidget
  components={{
    Launcher: CustomLauncher,
    WelcomeHeader: CustomWelcomeHeader,
  }}
/>
```

---

# 13. Agent Dashboard Requirements

The package must provide a complete dashboard through:

```tsx
<SupportDashboard />
```

Desktop layout:

```text
Conversation list | Active conversation | Customer details
```

Required functionality:

- Assigned conversations.
- Unassigned conversations.
- Open, waiting, resolved and closed filters.
- Search.
- Tags.
- Priority.
- Agent assignment.
- Status changes.
- Complete message timeline.
- Internal notes.
- Saved replies.
- Attachments.
- Customer information.
- Previous conversations.
- Typing indicator.
- Read state.
- Basic settings.
- Knowledge-base management.
- AI writing tools.

The package must also expose individual building blocks for advanced host customization.

---

# 14. API Structure

The default mount point is:

```text
/api/support
```

## Customer routes

```text
POST /api/support/session
GET  /api/support/conversations
POST /api/support/conversations
GET  /api/support/conversations/{id}
GET  /api/support/conversations/{id}/messages
POST /api/support/conversations/{id}/messages
POST /api/support/messages/{id}/read
POST /api/support/uploads
```

## Agent routes

```text
GET  /api/support/agent/conversations
GET  /api/support/agent/conversations/{id}
POST /api/support/agent/conversations/{id}/messages
POST /api/support/agent/conversations/{id}/notes
POST /api/support/agent/conversations/{id}/assign
POST /api/support/agent/conversations/{id}/resolve
POST /api/support/agent/conversations/{id}/reopen
GET  /api/support/agent/customers/{id}
GET  /api/support/agent/saved-replies
```

## AI routes

```text
POST /api/support/ai/rewrite
POST /api/support/ai/suggest-reply
POST /api/support/ai/summarize
POST /api/support/ai/translate
```

## Admin routes

```text
GET   /api/support/admin/settings
PATCH /api/support/admin/settings
GET   /api/support/admin/agents
PATCH /api/support/admin/agents/{id}
GET   /api/support/admin/knowledge
POST  /api/support/admin/knowledge
PATCH /api/support/admin/knowledge/{id}
DELETE /api/support/admin/knowledge/{id}
```

All routes must use shared Zod contracts.

---

# 15. Realtime Events

## Client events

```text
conversation.join
conversation.leave
message.send
message.read
typing.start
typing.stop
```

## Server events

```text
message.created
message.updated
message.delivery.updated
conversation.updated
typing.updated
agent.joined
agent.left
support.error
```

## Event envelope

```ts
export interface SupportRealtimeEvent<T = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  projectId: string;
  conversationId?: string;
  occurredAt: string;
  data: T;
}
```

## Rules

- Persist messages before broadcasting them.
- Authenticate every socket connection.
- Derive project identity server-side.
- Validate access before joining a conversation room.
- Validate every event payload.
- Rate-limit typing and presence events.
- Reject oversized payloads.
- Re-fetch missed messages after reconnection.
- Do not trust client-provided room names.

---

# 16. Permissions

Default support roles:

```text
support_admin
support_supervisor
support_agent
support_viewer
customer
anonymous_visitor
```

Permissions:

```text
conversation.read
conversation.reply
conversation.assign
conversation.close
conversation.reopen
conversation.mark_spam

internal_note.read
internal_note.create

customer.read
customer.update

knowledge.read
knowledge.manage

saved_reply.read
saved_reply.manage

support_settings.read
support_settings.manage

audit.read
```

Authorization rules:

- Default deny.
- Permission-based, not role-string checks.
- Project-aware.
- Resource-aware.
- Executed server-side.
- Tested with negative cases.

The host application may map its own roles into support permissions.

---

# 17. Security Requirements

## Never trust

- Project IDs from the browser.
- Agent roles from the browser.
- Customer identity without host authentication or a verified session.
- Conversation IDs without ownership checks.
- Message bodies.
- Attachment names.
- Browser-declared MIME types.
- Socket room names.
- AI outputs.
- postMessage events from unknown origins.

## Customer rules

A customer may:

- Create their own conversation.
- Read their own conversations.
- Send messages to their own conversations.
- Read public messages from their own conversations.
- Upload authorized attachments.

A customer may not:

- Read another customer's conversation.
- Read internal notes.
- Assign agents.
- Use agent routes.
- Use agent AI tools.

## Internal notes

Internal notes must be protected at three levels:

1. Separate message type.
2. Server-side authorization.
3. Separate customer serializer and realtime channel.

They must never be returned through customer APIs or customer socket events.

## Browser security

Use:

- Secure HttpOnly cookies where applicable.
- CSRF protection.
- Strict CORS.
- Content Security Policy.
- Safe text rendering.
- Sanitized rich text when enabled.
- Strict iframe and postMessage origins.
- No secrets in localStorage.

## Attachment security

- Private storage.
- File-size limits.
- Extension allowlist.
- Actual MIME detection.
- Random object keys.
- Malware scanning.
- Expiring download URLs.
- Authorization before download.
- No executable files.

## Rate limits

Apply limits to:

- Session creation.
- Conversation creation.
- Message sending.
- Uploads.
- AI requests.
- Typing events.
- Search.
- Login where managed by the support package.

---

# 18. AI Features

Initial agent-facing features:

- Fix grammar.
- Rewrite professionally.
- Rewrite warmly.
- Rewrite directly.
- Shorten.
- Expand.
- Simplify.
- Translate.
- Suggest reply.
- Summarize conversation.
- Extract unresolved questions.

Rules:

- AI output is always a draft.
- AI never sends messages automatically.
- Agent chooses whether to insert or replace text.
- AI failure must not break normal chat.
- Inputs must exclude secrets.
- Outputs must be validated and treated as untrusted.
- Usage limits must be configurable.

---

# 19. Chatbot Scope

The V1 chatbot may:

- Greet customers.
- Ask what help is needed.
- Search approved knowledge articles.
- Answer basic questions.
- Ask structured follow-up questions.
- Collect contact information.
- Escalate to an agent.
- Generate a handoff summary.

The V1 chatbot must not:

- Issue refunds.
- Cancel subscriptions.
- Change payments.
- Modify user accounts.
- Perform unrestricted backend actions.

State-changing actions may be added later with explicit confirmation, narrow permissions and audit logs.

---

# 20. CLI Requirements

## `support init`

- Detect host framework.
- Ask minimal setup questions.
- Generate configuration.
- Generate API route.
- Generate dashboard route.
- Generate widget component.
- Generate environment example.
- Generate migration directory.

## `support migrate`

- Validate database connectivity.
- Apply support migrations.
- Record migration history.
- Fail safely.

## `support seed`

- Create demo support agents.
- Create sample conversations only in development.

## `support doctor`

- Check environment variables.
- Check schema version.
- Check routes.
- Check authentication adapters.
- Check realtime configuration.
- Check optional AI and storage integrations.
- Return clear fixes.

## `support generate`

- Regenerate typed contracts or integration files when needed.

---

# 21. Testing Strategy

## Unit tests

Test:

- Permission checks.
- Conversation transitions.
- Assignment rules.
- Customer ownership.
- Message validation.
- Message idempotency.
- Internal-note filtering.
- Attachment rules.
- AI output validation.

## Integration tests

Use a real PostgreSQL test database.

Test:

- Database repositories.
- Transactions.
- Route handlers.
- Host authentication adapters.
- Customer ownership.
- Agent permissions.
- Project isolation.
- Socket authentication.
- Socket authorization.
- File download authorization.

## Mandatory security tests

- Customer changes conversation ID.
- Customer changes project ID.
- Agent attempts another project.
- Anonymous visitor requests authenticated history.
- Customer requests internal notes.
- Customer sends agent-only socket event.
- Unauthorized room join.
- Forged customer identity.
- Expired session.
- Revoked session.
- Duplicate message retry.
- Stored-XSS payload.
- Oversized message.
- Executable renamed as image.
- Guessed file ID.
- Typing-event flood.
- Prompt injection requesting another customer's data.

## End-to-end flow

1. Customer opens widget.
2. Customer starts conversation.
3. Agent receives conversation.
4. Agent replies.
5. Customer receives reply.
6. Customer reconnects.
7. History is preserved.
8. Duplicate messages are prevented.
9. Agent creates internal note.
10. Customer cannot see internal note.
11. Agent resolves conversation.
12. Customer submits rating.

## Installation test

CI must create or use a fresh example project and verify:

1. Package installation succeeds.
2. CLI initialization succeeds.
3. Migration succeeds.
4. Next.js project builds.
5. API route works.
6. Widget renders.
7. Dashboard renders.
8. Customer and agent exchange messages.

This is a release-blocking test.

---

# 22. Documentation Structure

```text
docs/
├── product/
│   ├── requirements.md
│   ├── scope.md
│   └── acceptance-criteria.md
│
├── architecture/
│   ├── overview.md
│   ├── packages.md
│   ├── database.md
│   ├── realtime.md
│   └── adapter-model.md
│
├── integration/
│   ├── installation.md
│   ├── nextjs.md
│   ├── authentication.md
│   ├── database.md
│   ├── realtime.md
│   ├── customization.md
│   └── troubleshooting.md
│
├── api/
│   ├── openapi.yaml
│   ├── errors.md
│   ├── socket-events.md
│   └── permissions.md
│
├── security/
│   ├── threat-model.md
│   ├── authorization.md
│   ├── attachments.md
│   └── security-checklist.md
│
└── testing/
    ├── strategy.md
    ├── authorization-matrix.md
    └── release-checklist.md
```

---

# 23. GitHub Distribution

## Repository

Create one private repository:

```text
github.com/OWNER/support-kit
```

## Package publishing

Publish versioned packages to GitHub Packages.

Main package:

```text
@OWNER/support
```

Consumer `.npmrc`:

```ini
@OWNER:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

Never commit an actual package token.

## Versioning

Use semantic versioning:

- Patch: bug fixes.
- Minor: backward-compatible features.
- Major: breaking changes.

Use Changesets to create release notes and coordinate package versions.

## Update flow

```bash
pnpm update @OWNER/support
```

Projects should be able to pin versions when stability is important.

---

# 24. Implementation Phases

## Phase 0: Repository foundation

Build:

- pnpm monorepo.
- Turborepo.
- TypeScript strict mode.
- Shared lint and formatting.
- Changesets.
- GitHub Actions.
- Package build system.
- Example Next.js project.

Exit criteria:

- All packages build.
- Example project builds.
- CI passes.

## Phase 1: Contracts and core domain

Build:

- Shared contracts.
- Domain entities.
- Permissions.
- Conversation state machine.
- Repository interfaces.
- Service interfaces.
- Domain errors.

Exit criteria:

- Core has no framework imports.
- Unit tests pass.

## Phase 2: Database adapter

Build:

- Drizzle schema.
- PostgreSQL migrations.
- Repository implementations.
- Transactions.
- Test helpers.

Exit criteria:

- Real-database integration tests pass.
- Project isolation tests pass.

## Phase 3: Next.js server adapter

Build:

- Configuration loader.
- Customer routes.
- Agent routes.
- Admin routes.
- Authentication adapter integration.
- Error handling.

Exit criteria:

- Example API works.
- Negative authorization tests pass.

## Phase 4: Realtime adapter

Build:

- Socket authentication.
- Conversation rooms.
- Message events.
- Typing.
- Presence.
- Read receipts.
- Reconnection.

Exit criteria:

- Unauthorized room access fails.
- Reconnection restores missed messages.

## Phase 5: Customer widget

Build:

- Launcher.
- Welcome screen.
- Conversation list.
- Active chat.
- Composer.
- Attachments.
- Offline state.
- Resolution and rating.
- Mobile behavior.
- Accessibility.

Exit criteria:

- Widget works by adding one component.
- No custom frontend is required.

## Phase 6: Agent dashboard

Build:

- Inbox.
- Conversation view.
- Customer panel.
- Assignment.
- Internal notes.
- Saved replies.
- Search and filters.

Exit criteria:

- Dashboard works by adding one component.
- Role-aware actions work server-side.

## Phase 7: CLI

Build:

- Init.
- Migrate.
- Seed.
- Doctor.
- Generate.

Exit criteria:

- Fresh example installation succeeds automatically.

## Phase 8: Attachments and notifications

Build:

- S3 adapter.
- Local development adapter.
- Authorized downloads.
- Notification interface.
- First email adapter.

## Phase 9: Chatbot and knowledge base

Build:

- Knowledge articles.
- Search.
- Basic answers.
- Handoff.
- Handoff summary.

## Phase 10: AI writing assistance

Build:

- Grammar correction.
- Rewrites.
- Suggested replies.
- Summaries.
- Translation.

## Phase 11: Hardening and release

Complete:

- Security suite.
- Accessibility suite.
- Installation suite.
- Load tests.
- Documentation.
- Example integration.
- Production release workflow.

---

# 25. V1 Scope

Build in V1:

- Next.js App Router support.
- PostgreSQL and Drizzle.
- Complete widget.
- Complete dashboard.
- Existing-user auth adapter.
- Anonymous visitor support.
- Realtime messaging.
- Read receipts.
- Typing indicators.
- Reconnection.
- Internal notes.
- Assignment.
- Conversation statuses.
- Saved replies.
- Attachments.
- Basic knowledge chatbot.
- Grammar correction.
- Suggested replies.
- CLI.
- GitHub Packages publishing.
- Example project.
- Installation documentation.
- Security and E2E tests.

Do not build in V1:

- Subscription billing.
- Organizations and workspace hierarchy.
- Multi-company SaaS accounts.
- Enterprise SSO.
- WhatsApp integration.
- Social inboxes.
- Voice or video calls.
- Advanced analytics.
- Workflow builder.
- Multiple ORM adapters.
- Multiple framework adapters.
- Microservices.
- Kubernetes.
- Fully autonomous AI agents.

---

# 26. Future Expansion

After V1 is stable, possible additions include:

- Prisma adapter.
- Express adapter.
- NestJS adapter.
- Managed realtime adapter.
- Multi-project central dashboard.
- Advanced analytics.
- Multiple teams and inboxes.
- SLA rules.
- Webhooks.
- Email inbox integration.
- WhatsApp integration.
- Hosted SaaS version.
- Subscription plans.

These must not complicate the initial implementation.

---

# 27. AGENTS.md Rules

Create an `AGENTS.md` file with these rules:

```md
# Engineering Rules

## Read before coding

Before implementing a task, read:

1. AGENTS.md.
2. The master blueprint.
3. The relevant architecture document.
4. The relevant API contract.
5. The relevant security document.
6. The relevant testing document.

## Architecture

1. Keep the core framework-independent.
2. Put Next.js behavior only in the Next.js adapter.
3. Put Drizzle behavior only in the database adapter.
4. Put Socket.IO behavior only in the realtime adapter.
5. Do not expose unstable internals from the public package.
6. Do not add a new dependency without justification.

## Security

1. Never trust client-provided project IDs.
2. Never trust client-provided roles.
3. Never bypass centralized authorization.
4. Never expose internal notes to customers.
5. Never log tokens, passwords or cookies.
6. Never weaken a security check to make a test pass.
7. Treat AI output as untrusted.
8. Validate every external input.
9. Every tenant-owned query must include project scope.
10. Every sensitive action requires negative tests.

## API changes

Any API change requires:

- Shared contract update.
- Validation.
- Error definition.
- Authorization rule.
- Unit tests.
- Integration tests.
- Negative tests.
- Documentation update.

## Database changes

- Use migrations.
- Do not modify shipped migrations.
- Add constraints.
- Add project-aware indexes.
- Test isolation.
- Document rollback implications.

## Completion

Before marking a task complete:

- Run type checking.
- Run linting.
- Run unit tests.
- Run relevant integration tests.
- Run relevant security tests.
- Build packages.
- Build the example project.
- Report files changed.
- Report remaining risks honestly.
```

---

# 28. Codex Execution Rules

Do not ask Codex to build the entire product in one prompt.

Use one bounded task at a time.

Standard prompt template:

```text
Read first:

- AGENTS.md
- docs/MASTER_BLUEPRINT.md
- relevant architecture documentation
- relevant API documentation
- relevant security documentation
- relevant testing documentation

Task:

[One bounded implementation task]

Requirements:

- Follow package boundaries.
- Do not modify unrelated modules.
- Use shared contracts.
- Validate all external input.
- Derive project context server-side.
- Use centralized authorization.
- Add audit events where required.
- Add unit tests.
- Add integration tests.
- Add negative authorization tests.
- Update documentation.

Completion checks:

- Type checking passes.
- Linting passes.
- Relevant tests pass.
- All affected packages build.
- Example project still builds.

Return:

1. Summary.
2. Files changed.
3. Tests added.
4. Commands executed.
5. Remaining risks.
```

---

# 29. First Codex Tasks

## Task 1: Initialize repository

```text
Create the pnpm monorepo defined in docs/MASTER_BLUEPRINT.md.

Create:

- packages/core
- packages/contracts
- packages/db-drizzle
- packages/server-nextjs
- packages/realtime-socketio
- packages/react
- packages/widget
- packages/dashboard
- packages/ai
- packages/storage-s3
- packages/notifications
- packages/cli
- packages/support
- examples/nextjs-demo

Configure:

- TypeScript strict mode
- Turborepo
- shared ESLint
- shared formatting
- Vitest
- Playwright
- Changesets
- GitHub Actions
- package build outputs

Do not implement support functionality yet.

Add tests that verify all packages and the example application build.
```

## Task 2: Implement shared contracts

```text
Implement shared contracts for:

- project identity
- customer identity
- agent identity
- permissions
- conversation status
- message type
- sender type
- delivery state
- API errors
- realtime event envelope
- support configuration

Use Zod and export inferred TypeScript types.

Add unit tests for valid and invalid inputs.
```

## Task 3: Implement core domain

```text
Implement framework-independent core domain logic for:

- conversations
- messages
- assignments
- internal notes
- conversation transitions
- permission evaluation
- audit event generation
- repository interfaces

Do not import Next.js, React, Drizzle or Socket.IO.

Add comprehensive unit tests and negative permission tests.
```

## Task 4: Implement Drizzle adapter

```text
Implement the PostgreSQL Drizzle adapter and support schema.

Use support_ table prefixes.

Include:

- migrations
- repository implementations
- transactions
- project isolation
- client_message_id idempotency
- test database utilities

Add integration and cross-project isolation tests.
```

## Task 5: Implement Next.js server adapter

```text
Implement the first Next.js App Router adapter.

Include:

- createSupportHandler
- configuration loading
- customer routes
- agent routes
- admin routes
- authentication adapter integration
- structured errors
- request validation

Integrate it into examples/nextjs-demo.

Add API integration and authorization tests.
```

---

# 30. Definition of Done

A feature is complete only when:

```text
[ ] Product acceptance criteria pass
[ ] Package boundaries are respected
[ ] Shared contracts are updated
[ ] Input validation exists
[ ] Authorization rule is explicit
[ ] Project isolation is enforced
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Negative authorization tests pass
[ ] Type checking passes
[ ] Linting passes
[ ] Package builds pass
[ ] Example project builds
[ ] Installation flow remains valid
[ ] Documentation is updated
[ ] No critical security issue remains
```

---

# 31. First Production Milestone

The first milestone is complete when:

1. A fresh Next.js application installs `@OWNER/support`.
2. The CLI generates configuration and routes.
3. Support migrations run successfully.
4. Existing host users become support customers.
5. Existing host admins become support agents.
6. The customer widget is added with one component.
7. The agent dashboard is added with one component.
8. A customer starts a conversation.
9. An agent receives and replies to it.
10. Realtime delivery works.
11. Reconnection preserves history.
12. Duplicate messages are prevented.
13. Internal notes remain invisible to the customer.
14. Attachments are authorized.
15. Project isolation tests pass.
16. Documentation is sufficient for installation into a second project without editing package source.

Do not prioritize chatbot or AI before this milestone is stable.

---

# 32. Final Engineering Direction

Build one maintainable GitHub repository that publishes a versioned support package.

The architecture should be:

```text
Framework-independent support core
        ↓
Database, framework and realtime adapters
        ↓
Prebuilt customer widget and agent dashboard
        ↓
One simple package installed into host projects
```

The package must be easy for the consumer and disciplined internally.

The main design rule is:

> The host project provides identity, database connection and configuration. The support package provides the customer-support product.

Do not build a full SaaS platform before proving that the package can be installed cleanly, updated safely and used reliably across multiple existing projects.
