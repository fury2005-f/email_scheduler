# ReachInbox Email Scheduler Engine

A production-grade, distributed email scheduling service and operational dashboard designed for cold outreach at scale. Powered by **Express.js, TypeScript, BullMQ, Redis, PostgreSQL (Prisma ORM), Nodemailer (Ethereal SMTP), Next.js (App Router), and NextAuth.js**.

---

## Technical Architecture & Core System Guarantees

```
                                +---------------------------+
                                | Next.js Frontend Dashboard|
                                | (Google OAuth / NextAuth) |
                                +-------------+-------------+
                                              |
                                              v (HTTP API)
                                +-------------+-------------+
                                |  Express.js Backend Server|
                                +------+--------------+-----+
                                       |              |
                (1. Create PENDING Row)|              |(2. Enqueue Job: jobId = UUID)
                                       v              v
                              +--------+-----+  +-----+-------+
                              | PostgreSQL   |  | Redis       |
                              | Source of    |  | BullMQ      |
                              | Truth        |  | Delayed Jobs|
                              +--------+-----+  +-----+-------+
                                       ^              |
                                       |              |(3. Process Job)
                                       +------+-------+
                                              v
                                   +----------+----------+
                                   |  BullMQ Email Worker|
                                   |  Concurrency: N     |
                                   +----------+----------+
                                              |
                                              | (4. Check Quota & Send)
                                              v
                                   +----------+----------+
                                   | Ethereal SMTP Server|
                                   +---------------------+
```

### 1. Source of Truth & Enqueue Strategy
- **PostgreSQL as Primary Storage**: Every scheduled email request creates a database row with status `PENDING`, `originalScheduledAt`, and `sequenceNumber` **before** any job is pushed to BullMQ.
- **Stable Job ID Idempotency**: The BullMQ delayed job ID is explicitly set to the PostgreSQL record UUID (`jobId: email.id`). BullMQ rejects duplicate enqueue attempts with the same `jobId`, guaranteeing 1-to-1 mapping.
- **Worker Level Idempotency**: When a worker picks up a job from Redis, it queries the database record first. If the status is already `SENT` or `FAILED`, the worker terminates immediately without re-dispatching, preventing double-sends under retries or network blips.

### 2. Dual-Layer Throttling & Rate Limiting

The engine enforces two independent levels of rate limiting:

1. **Layer 1: Queue-Level Minimum Delay (`MIN_SEND_INTERVAL_MS`)**:
   - Configured directly on the BullMQ worker constructor via `limiter: { max: 1, duration: env.MIN_SEND_INTERVAL_MS }`.
   - Prevents overwhelming local SMTP transports by pacing sends evenly (e.g. 1000ms pause between consecutive dispatches).

2. **Layer 2: Hourly Email Cap (`MAX_EMAILS_PER_HOUR` & `MAX_EMAILS_PER_HOUR_PER_SENDER`)**:
   - Backed by Redis atomic window counters: `emails:counter:global:{YYYY-MM-DD-HH}` and `emails:counter:{sender}:{YYYY-MM-DD-HH}` with TTL set to the end of the hour window.
   - **Re-Delaying & Strict FIFO Order Preservation**: When an hourly cap is exceeded, the job is **not marked as failed**. The worker calculates the exact milliseconds until the start of the next hour window (`nextHourMs`) plus a sequence-based micro-offset (`sequenceNumber % 1000 * 50ms`) and calls `job.moveToDelayed(...)`. This preserves original submission order (FIFO) across hour window transitions.

### 3. Server Crash Recovery & Restart Persistence Strategy
- **No Blind DB Re-Seeding**: On worker startup, the backend **does not** query PostgreSQL and re-add jobs to BullMQ. BullMQ delayed jobs are stored durably in Redis and automatically survive server restarts. Re-adding jobs from DB on boot would cause duplicate job entries in Redis.
- **Stale `SENDING` Job Recovery**: If the backend process crashes while a worker is actively transmitting an email over SMTP (leaving the DB row in state `SENDING`), the startup boot sequence invokes `reconcileStaleSendingJobs()`. Any `SENDING` record untouched for > 2 minutes is automatically reset back to `PENDING`, allowing the persistent Redis job (or retry worker) to re-process it safely.

### 4. Exponential Backoff & Retries
- All jobs are queued with `attempts: 3` and `backoff: { type: 'exponential', delay: 5000 }`. Transient SMTP connection drops or database deadlocks trigger standard BullMQ backoffs instead of dropping jobs silently.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | TypeScript, Express.js, BullMQ 5, ioredis, PostgreSQL 16, Prisma ORM, Nodemailer |
| **Frontend** | Next.js 14 (App Router), TypeScript, NextAuth.js (Google OAuth), Tailwind CSS, Lucide Icons, PapaParse |
| **Infrastructure** | Docker Compose (Redis 7 + PostgreSQL 16) |
| **Email Transport** | Ethereal Email (Fake SMTP with web preview URLs) |

---

## Environment Variables Configuration

### Backend (`backend/.env`)

```env
PORT=4000
DATABASE_URL="postgresql://reachinbox:reachinbox_password@localhost:5432/email_scheduler?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

WORKER_CONCURRENCY=5
MIN_SEND_INTERVAL_MS=1000
MAX_EMAILS_PER_HOUR=50
MAX_EMAILS_PER_HOUR_PER_SENDER=10

# Optional: Ethereal SMTP Credentials. If omitted, Ethereal test account is auto-created on startup.
ETHEREAL_USER=
ETHEREAL_PASS=
```

### Frontend (`frontend/.env.local`)

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=reachinbox_nextauth_secret_key_production_grade_32_chars

# Real Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## Quick Start Guide

### Prerequisites
- Node.js >= 18.x
- Docker & Docker Compose (or local PostgreSQL 16 & Redis 7 services)

### Step 1: Start Infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

### Step 2: Set Up Backend

```bash
cd backend
npm install
npx prisma db push
npm run dev
```

The backend server will start on `http://localhost:4000`. You will see boot logs confirming:
- Ethereal SMTP account initialization
- Stale `SENDING` job reconciliation scan
- BullMQ Worker boot (`Concurrency: 5`, `Min Delay: 1000ms`)

### Step 3: Set Up Frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend dashboard will be available at `http://localhost:3000`.

---

## Features Checklist

### Backend Requirements
- [x] `POST /api/emails/schedule` — schedule single or bulk emails from CSV/text.
- [x] PostgreSQL DB persistence before queueing (source of truth).
- [x] BullMQ delayed jobs with stable `jobId` (`jobId: email.id`) for idempotency.
- [x] No blind re-seeding on boot — worker leverages durable Redis queue state.
- [x] Configurable worker concurrency via `WORKER_CONCURRENCY`.
- [x] Queue-level minimum delay throttle via `MIN_SEND_INTERVAL_MS` (`limiter: { max: 1, duration }`).
- [x] Sliding/fixed hourly rate limiter (`MAX_EMAILS_PER_HOUR`, `MAX_EMAILS_PER_HOUR_PER_SENDER`) re-delaying to next hour window with FIFO sequence preservation.
- [x] Stale `SENDING` job crash recovery.
- [x] Ethereal SMTP integration returning live preview links (`getTestMessageUrl`).
- [x] Zero duplicate sends guarantee under retries and server restarts.

### Frontend Requirements
- [x] Real Google OAuth login via NextAuth.js.
- [x] Dashboard with Tabbed views: **Scheduled Queue** and **Sent Archive**.
- [x] Metric overview cards displaying Scheduled, Sent, Failed, and Hourly Quota progress bar.
- [x] Compose Email modal with CSV dropzone, client-side lead detection, recipient chip list, datetime-local picker, and delay input.
- [x] Scheduled Emails Table with relative countdowns, sequence IDs, and status badges.
- [x] Sent Emails Table with Ethereal email preview links, sent timestamps, and failure details.
- [x] Auto-polling live update engine (5s interval).
- [x] Slate operational UI theme tailored for outbound operations.

---

## API Surface Specification

### `POST /api/emails/schedule`
Schedule single or bulk emails.
**Request Body**:
```json
{
  "subject": "Quick question regarding cold outreach",
  "body": "<p>Hi {{firstName}}, I noticed your outreach pipeline...</p>",
  "recipients": ["lead1@acme.com", "lead2@tech.io"],
  "sender": "outreach@reachinbox.ai",
  "startTime": "2026-08-19T20:50:00.000Z",
  "delayBetweenEmailsMs": 2000
}
```

### `GET /api/emails/scheduled?page=1&limit=20&status=PENDING`
Returns paginated scheduled/pending emails ordered by `scheduledAt ASC`.

### `GET /api/emails/sent?page=1&limit=20&status=SENT`
Returns paginated sent/failed emails with Ethereal preview links ordered by `updatedAt DESC`.

### `GET /api/emails/stats`
Returns system metrics: queue counts (pending, sending, sent, failed) and hourly quota usage.

---

## Verification & Restart Persistence Demo Guide

To demonstrate zero lost jobs and zero duplicate sends:

1. Open dashboard at `http://localhost:3000` and click **Compose New Email**.
2. Enter subject, body, and set **Start Schedule Time** 45 seconds into the future.
3. Click **Schedule Email Dispatch**.
4. Stop the backend server (`Ctrl+C` in the backend terminal).
5. Wait 60 seconds (past the scheduled send time).
6. Restart the backend server (`npm run dev`).
7. **Observation**: BullMQ re-attaches to Redis, picks up the delayed job, checks PostgreSQL status (`PENDING`), dispatches via Ethereal, and marks status `SENT`. Zero jobs are dropped and no email is sent twice.
