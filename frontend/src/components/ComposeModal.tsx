'use client';

import { useState, useRef } from 'react';
import { submitScheduleEmails } from '@/lib/api';
import Papa from 'papaparse';
import { X, Upload, Mail, Calendar, Clock, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ComposeModal({ isOpen, onClose, onSuccess }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedLeads, setParsedLeads] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  
  // Schedule settings
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16); // format YYYY-MM-DDTHH:mm for datetime-local
  });
  const [delayBetweenEmailsSec, setDelayBetweenEmailsSec] = useState<number>(2);
  const [sender, setSender] = useState('outreach@reachinbox.ai');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Client-side CSV parser
  const handleCsvUpload = (file: File) => {
    setError(null);
    setCsvFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        const emails = new Set<string>();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        results.data.forEach((row: any) => {
          const rowStr = Array.isArray(row) ? row.join(' ') : JSON.stringify(row);
          const matches = rowStr.match(emailRegex);
          if (matches) {
            matches.forEach((e) => emails.add(e.toLowerCase()));
          }
        });

        const leadArray = Array.from(emails);
        if (leadArray.length === 0) {
          setError('No valid email addresses detected in CSV file');
        } else {
          setParsedLeads(leadArray);
        }
      },
      error: (err) => {
        setError(`CSV parse error: ${err.message}`);
      },
    });
  };

  const getFinalRecipients = (): string[] => {
    if (parsedLeads.length > 0) return parsedLeads;
    return manualRecipients
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const recipients = getFinalRecipients();

    if (recipients.length === 0) {
      setError('Please provide at least one valid recipient email or upload a CSV lead list.');
      return;
    }

    if (!subject.trim()) {
      setError('Email subject line is required.');
      return;
    }

    if (!body.trim()) {
      setError('Email body content is required.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        sender,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delayBetweenEmailsMs: delayBetweenEmailsSec * 1000,
      };

      const res = await submitScheduleEmails(payload);
      setSuccessMessage(`Successfully queued ${res.count} email job(s)!`);
      
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset form
        setSubject('');
        setBody('');
        setManualRecipients('');
        setParsedLeads([]);
        setCsvFileName(null);
        setLoading(false);
        setSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to schedule emails');
      setLoading(false);
    }
  };

  const activeLeadCount = getFinalRecipients().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#0f172a]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Compose Cold Outreach Email</h2>
              <p className="text-xs text-gray-400">Schedule single or bulk email dispatch via BullMQ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Lead Recipients Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-medium text-gray-300">
                Recipients / Leads ({activeLeadCount} detected)
              </label>
              {csvFileName && (
                <button
                  type="button"
                  onClick={() => {
                    setParsedLeads([]);
                    setCsvFileName(null);
                  }}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Clear CSV ({csvFileName})
                </button>
              )}
            </div>

            {/* CSV Dropzone & Manual Input Tabs */}
            {parsedLeads.length > 0 ? (
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/50 space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300">
                  <span className="font-semibold">CSV Lead List Loaded: {csvFileName}</span>
                  <span className="bg-indigo-900/60 px-2 py-0.5 rounded font-mono text-[11px]">
                    {parsedLeads.length} recipients
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1.5 pt-1">
                  {parsedLeads.slice(0, 15).map((email, idx) => (
                    <span key={idx} className="bg-indigo-950 text-indigo-200 border border-indigo-800/60 text-[11px] px-2 py-0.5 rounded font-mono">
                      {email}
                    </span>
                  ))}
                  {parsedLeads.length > 15 && (
                    <span className="text-[11px] text-indigo-400 font-mono self-center">
                      +{parsedLeads.length - 15} more
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  placeholder="Enter email addresses separated by commas or line breaks (e.g. lead1@acme.com, lead2@tech.io)"
                  className="w-full bg-[#0b0f17] border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />

                {/* CSV File Upload Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-gray-700 hover:border-indigo-500 bg-[#0b0f17]/50 rounded-lg p-3 text-center cursor-pointer transition-colors group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvUpload(file);
                    }}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 group-hover:text-indigo-400">
                    <Upload className="w-4 h-4" />
                    <span>Upload Lead CSV file (auto-detects lead emails)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subject Line */}
          <div>
            <label className="block font-medium text-gray-300 mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Quick question regarding your outbound pipeline"
              className="w-full bg-[#0b0f17] border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Body Content */}
          <div>
            <label className="block font-medium text-gray-300 mb-1">Email Body (HTML / Plain text)</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}},&#10;&#10;I noticed your outreach team is looking for automated job queueing..."
              className="w-full bg-[#0b0f17] border border-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-sans text-sm"
            />
          </div>

          {/* Schedule Parameters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Start Schedule Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#0b0f17] border border-gray-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Min Stagger Delay (Seconds)</span>
              </label>
              <input
                type="number"
                min={0}
                max={3600}
                value={delayBetweenEmailsSec}
                onChange={(e) => setDelayBetweenEmailsSec(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#0b0f17] border border-gray-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#0f172a] flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            {activeLeadCount > 0 ? `${activeLeadCount} email(s) ready` : 'No leads specified'}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enqueueing Jobs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Schedule Email Dispatch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
