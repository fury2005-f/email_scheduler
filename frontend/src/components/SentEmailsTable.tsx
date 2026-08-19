'use client';

import { EmailItem, PaginatedResponse } from '@/lib/api';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Filter, Inbox } from 'lucide-react';

interface Props {
  data: PaginatedResponse<EmailItem> | null;
  loading: boolean;
  onRefresh: () => void;
  page: number;
  setPage: (p: number) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
}

export function SentEmailsTable({
  data,
  loading,
  onRefresh,
  page,
  setPage,
  statusFilter,
  setStatusFilter,
}: Props) {
  const emails = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Header Controls */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#0f172a]/60">
        <div className="flex items-center space-x-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm">Sent Email Archive ({pagination.total})</h3>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* Status Filter */}
          <div className="flex items-center space-x-2 bg-[#0b0f17] border border-gray-800 rounded-lg px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">All Delivery Statuses</option>
              <option value="SENT" className="bg-gray-900">SENT</option>
              <option value="FAILED" className="bg-gray-900">FAILED</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#0b0f17] border border-gray-800 hover:border-gray-700 transition-colors"
            title="Refresh Table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b0f17]/70 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
            <tr>
              <th className="py-3 px-6">Recipient</th>
              <th className="py-3 px-6">Subject</th>
              <th className="py-3 px-6">Sent Time</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono text-gray-300">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500 font-sans">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading sent archive...</span>
                  </div>
                </td>
              </tr>
            ) : emails.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-gray-800/60 flex items-center justify-center text-gray-500">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-gray-300 font-medium text-sm">No delivered email dispatches recorded</p>
                    <p className="text-xs text-gray-500 max-w-sm">
                      When scheduled BullMQ jobs complete execution via Ethereal SMTP, they will be archived here with preview links.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => {
                const formattedSentAt = email.sentAt
                  ? new Date(email.sentAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'N/A';

                return (
                  <tr key={email.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-6 font-semibold text-white font-mono">{email.recipient}</td>
                    <td className="py-3 px-6 font-sans text-gray-200 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 px-6 text-gray-400 font-mono">{formattedSentAt}</td>
                    <td className="py-3 px-6 font-sans">
                      {email.status === 'SENT' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                          SENT
                        </span>
                      ) : (
                        <span
                          title={email.error || 'Failed to dispatch email'}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800 cursor-help"
                        >
                          <AlertCircle className="w-3 h-3 mr-1 text-rose-400" />
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right font-sans">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 border border-indigo-800/60 px-2.5 py-1 rounded hover:bg-indigo-900/50 transition-colors"
                        >
                          <span>View Ethereal Email</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-gray-500 text-[11px] font-mono">No Preview</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-800 bg-[#0f172a]/40 flex items-center justify-between text-xs text-gray-400">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 rounded bg-[#0b0f17] border border-gray-800 hover:border-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1 rounded bg-[#0b0f17] border border-gray-800 hover:border-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
