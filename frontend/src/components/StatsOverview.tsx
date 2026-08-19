'use client';

import { StatsData } from '@/lib/api';
import { Clock, CheckCircle2, AlertTriangle, Gauge, Cpu } from 'lucide-react';

interface Props {
  stats: StatsData | null;
  loading: boolean;
}

export function StatsOverview({ stats, loading }: Props) {
  const summary = stats?.summary || { pending: 0, sending: 0, sent: 0, failed: 0, totalScheduled: 0 };
  const quota = stats?.quota || { currentHourUsed: 0, maxEmailsPerHour: 50, maxEmailsPerHourPerSender: 10, workerConcurrency: 5, minSendIntervalMs: 1000 };

  const quotaPercent = Math.min(100, Math.round((quota.currentHourUsed / quota.maxEmailsPerHour) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Metric 1: Scheduled Queue */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Scheduled Queue</p>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">
              {loading ? '...' : summary.pending + summary.sending}
            </span>
            <span className="text-xs text-amber-400 font-mono">({summary.sending} active)</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Pending BullMQ delayed jobs</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 2: Delivered */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Delivered Emails</p>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">
              {loading ? '...' : summary.sent}
            </span>
            <span className="text-xs text-emerald-400 font-mono">Sent</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Confirmed Ethereal SMTP dispatches</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 3: Delivery Failures */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Failed Dispatches</p>
          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">
              {loading ? '...' : summary.failed}
            </span>
            <span className="text-xs text-rose-400 font-mono">Errors</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Final attempt errors</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 4: Hourly Rate Quota */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="w-full pr-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Hourly Quota</p>
            <span className="text-[11px] font-mono text-indigo-400">
              {quota.currentHourUsed} / {quota.maxEmailsPerHour}
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                quotaPercent >= 90 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center justify-between font-mono">
            <span>Limit: {quota.maxEmailsPerHour}/hr</span>
            <span>Interval: {quota.minSendIntervalMs}ms</span>
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
          <Gauge className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
