const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface EmailItem {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  originalScheduledAt: string;
  sequenceNumber: string;
  sentAt: string | null;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  error: string | null;
  etherealPreviewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface StatsData {
  summary: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    totalScheduled: number;
  };
  quota: {
    currentHourUsed: number;
    maxEmailsPerHour: number;
    maxEmailsPerHourPerSender: number;
    workerConcurrency: number;
    minSendIntervalMs: number;
  };
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  sender?: string;
  startTime?: string;
  delayBetweenEmailsMs?: number;
}

export async function fetchScheduledEmails(page = 1, limit = 20, status?: string): Promise<PaginatedResponse<EmailItem>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);

  const res = await fetch(`${API_BASE_URL}/api/emails/scheduled?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch scheduled emails');
  return res.json();
}

export async function fetchSentEmails(page = 1, limit = 20, status?: string): Promise<PaginatedResponse<EmailItem>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);

  const res = await fetch(`${API_BASE_URL}/api/emails/sent?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sent emails');
  return res.json();
}

export async function fetchStats(): Promise<StatsData> {
  const res = await fetch(`${API_BASE_URL}/api/emails/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function submitScheduleEmails(payload: SchedulePayload): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/emails/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to schedule emails');
  }

  return res.json();
}
