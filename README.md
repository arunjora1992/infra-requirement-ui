# Infra Requirements UI

A futuristic, dark/light-themed Next.js app for raising and tracking infrastructure
requirements (VMs, Kubernetes pods, BoQ uploads, tenure, manager sign-off) with
Google authentication and automatic expiry alerts.

## Features

- Sign in with **Google** (NextAuth + Prisma adapter, domain allow-list optional)
- Roles: `USER` (raiser) · `MANAGER` · `INFRA` · `ADMIN`
- Raise a requirement with:
  - VM count + per-VM CPU/RAM/Disk/OS
  - Pod count + CPU/memory/cluster/namespace
  - Network (LB, public IP), managed DB, extra storage
  - Tenure (days), start date, cost center, justification
  - Manager name + email, date of raise (auto)
  - **BoQ upload** (PDF/XLSX/DOCX/CSV/ZIP, ≤25 MB)
- Infra team:
  - Status workflow: `SUBMITTED → IN_REVIEW → APPROVED → PROVISIONED → EXPIRED → SHUTDOWN`
  - **CSV export** of all or new requirements
  - Per-requirement attachment downloads
- **Alert mechanism** (in-app daily cron, configurable):
  - **T−7**: warning email to raiser + manager + infra
  - **T+1 … T+7**: daily post-expiry reminder
  - **T+7**: shutdown notice, requirement auto-flipped to `SHUTDOWN`
- **Dark/light theme** toggle, futuristic glass+grid styling

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma + Postgres ·
NextAuth (Google) · node-cron · Nodemailer · Docker Compose

## Quick start (Docker Compose)

```bash
cp .env.example .env
# edit .env: NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SMTP_*, *_EMAILS
docker compose up -d --build
# open http://localhost:3000
```

The compose stack runs:

- `db` — Postgres 16 (named volume `db_data`)
- `app` — Next.js app, runs Prisma migrations on boot and starts the daily alert cron

Uploads are persisted in the `uploads` named volume.

### Google OAuth setup

1. Visit https://console.cloud.google.com/apis/credentials.
2. Create an **OAuth client ID** of type *Web application*.
3. Add an authorized redirect URI:
   ```
   ${NEXTAUTH_URL}/api/auth/callback/google
   ```
   For local dev that's `http://localhost:3000/api/auth/callback/google`.
4. Copy the client ID/secret into `.env`.

Optionally restrict by Workspace domain via `ALLOWED_EMAIL_DOMAINS=company.com,partner.com`.

### Bootstrapping roles

On first sign-in the app creates a `User` row. To grant elevated roles before that
user signs in, list their emails in `.env`:

```
ADMIN_EMAILS=admin@company.com
INFRA_EMAILS=infra1@company.com,infra2@company.com
MANAGER_EMAILS=lead@company.com
```

Admins can also change roles at runtime in **/admin**.

### SMTP / email

`MAIL_DRY_RUN=true` (default) logs messages to stdout instead of sending — useful
until SMTP credentials are wired up. Once you've set `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`,
set `MAIL_DRY_RUN=false`.

The daily sweep runs on the cron expression in `ALERT_CRON` (default `0 9 * * *`).

## Local development (without Docker)

```bash
npm install
# point DATABASE_URL at a local Postgres
npx prisma migrate dev
npm run dev
```

## Project layout

```
src/
  app/
    api/                 # REST endpoints (NextAuth, requirements, attachments, export, admin)
    dashboard/           # Table + filters
    requirements/new/    # Create form
    requirements/[id]/   # Detail + activity + status actions
    admin/               # User/role management
  components/            # Navbar, theme toggle, badges
  lib/
    alerts.ts            # Alert sweep logic (T-7 / T+N / T+7 shutdown)
    scheduler.ts         # node-cron entry point
    mailer.ts            # Nodemailer transport (dry-run capable)
    email-templates.ts   # HTML mail templates
    auth.ts              # NextAuth options + role bootstrap
    db.ts                # Prisma client
    uploads.ts           # File upload helper
    csv.ts               # CSV serializer for export
    validators.ts        # Zod schemas
prisma/schema.prisma
docker-compose.yml
Dockerfile
docker/entrypoint.sh     # waits for DB, runs migrate deploy, starts app
```

## Roadmap

Tracked as additional features in subsequent PRs:

- Extension requests workflow
- Slack / Microsoft Teams webhook alerts
- Cost estimation per BoQ line
- API tokens for IaC automation
- Audit log export
