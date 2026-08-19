'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import { StatsOverview } from '@/components/StatsOverview';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { ComposeModal } from '@/components/ComposeModal';
import { LoginCard } from '@/components/LoginCard';
import {
  fetchStats,
  fetchScheduledEmails,
  fetchSentEmails,
  StatsData,
  PaginatedResponse,
  EmailItem,
} from '@/lib/api';
import { Plus, Clock, CheckCircle2, RefreshCw, Zap } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState<StatsData | null>(null);
  const [scheduledData, setScheduledData] = useState<PaginatedResponse<EmailItem> | null>(null);
  const [sentData, setSentData] = useState<PaginatedResponse<EmailItem> | null>(null);

  // Loading states
  const [statsLoading, setStatsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  // Pagination & filter states
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledFilter, setScheduledFilter] = useState('');

  const [sentPage, setSentPage] = useState(1);
  const [sentFilter, setSentFilter] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchStats();
      setStats(s);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadTableData = useCallback(async () => {
    setTableLoading(true);
    try {
      if (activeTab === 'scheduled') {
        const res = await fetchScheduledEmails(scheduledPage, 20, scheduledFilter);
        setScheduledData(res);
      } else {
        const res = await fetchSentEmails(sentPage, 20, sentFilter);
        setSentData(res);
      }
    } catch (err) {
      console.error(`Error fetching ${activeTab} emails:`, err);
    } finally {
      setTableLoading(false);
    }
  }, [activeTab, scheduledPage, scheduledFilter, sentPage, sentFilter]);

  // Initial and periodic poll (every 5s) for live dispatch updates
  useEffect(() => {
    if (session?.user) {
      loadStats();
      loadTableData();

      const interval = setInterval(() => {
        loadStats();
        loadTableData();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [session, loadStats, loadTableData]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center text-gray-400 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing ReachInbox Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0b0f17]">
        <Navbar />
        <LoginCard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Outreach Dispatch Control</h1>
            <p className="text-xs text-gray-400 mt-1">
              Monitor BullMQ job queueing, rate limit quotas, and Ethereal SMTP dispatches
            </p>
          </div>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>
        </div>

        {/* Stats Overview */}
        <StatsOverview stats={stats} loading={statsLoading} />

        {/* Tabs & Table Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
                  activeTab === 'scheduled'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Scheduled Emails Queue</span>
                {stats?.summary.pending !== undefined && (
                  <span className="ml-1 bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {stats.summary.pending + stats.summary.sending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('sent')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
                  activeTab === 'sent'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sent Emails Archive</span>
                {stats?.summary.sent !== undefined && (
                  <span className="ml-1 bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {stats.summary.sent}
                  </span>
                )}
              </button>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-[11px] text-gray-500 font-mono">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Auto-refreshing every 5s</span>
            </div>
          </div>

          {/* Active Table view */}
          {activeTab === 'scheduled' ? (
            <ScheduledEmailsTable
              data={scheduledData}
              loading={tableLoading}
              onRefresh={() => {
                loadStats();
                loadTableData();
              }}
              page={scheduledPage}
              setPage={setScheduledPage}
              statusFilter={scheduledFilter}
              setStatusFilter={setScheduledFilter}
            />
          ) : (
            <SentEmailsTable
              data={sentData}
              loading={tableLoading}
              onRefresh={() => {
                loadStats();
                loadTableData();
              }}
              page={sentPage}
              setPage={setSentPage}
              statusFilter={sentFilter}
              setStatusFilter={setSentFilter}
            />
          )}
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          loadStats();
          loadTableData();
        }}
      />
    </div>
  );
}
