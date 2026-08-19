import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { emailRouter } from './routes/emailRoutes';
import { getTransporter } from './services/etherealService';
import { startEmailWorker, reconcileStaleSendingJobs } from './workers/emailWorker';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// API routes
app.use('/api/emails', emailRouter);

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'reachinbox-email-scheduler',
    timestamp: new Date().toISOString(),
  });
});

async function main() {
  try {
    // 1. Initialize Ethereal Transporter
    await getTransporter();

    // 2. Reconcile stale SENDING database rows from previous server crashes
    await reconcileStaleSendingJobs();

    // 3. Boot BullMQ Worker Process
    startEmailWorker();

    // 4. Start HTTP Server
    app.listen(env.PORT, () => {
      console.log(`[Server Boot] ReachInbox Email Scheduler running on port ${env.PORT}`);
    });
  } catch (err) {
    console.error('[Server Boot Error] Failed to start backend service:', err);
    process.exit(1);
  }
}

main();
