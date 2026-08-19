'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Mail, ShieldCheck, Zap, Server, Lock, ArrowRight } from 'lucide-react';

export function LoginCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: 'outreach.admin@reachinbox.ai',
      });

      if (result?.ok) {
        // Hard reload to pick up the new session cookie
        window.location.reload();
      } else {
        setError('Sign-in failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError('Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Google OAuth uses server-side redirect, so we let NextAuth handle it
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ReachInbox</h1>
          <p className="text-sm text-gray-400">AI Cold-Outreach Email Scheduler Engine</p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-3 bg-[#0b0f17] border border-gray-800/80 rounded-xl p-4 text-xs text-gray-300">
          <div className="flex items-center space-x-2.5">
            <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>BullMQ Delayed Queueing backed by Redis</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Server className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>PostgreSQL source of truth & idempotency checks</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Dual-layer rate limiting & server crash recovery</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Primary: Instant sign-in that always works */}
          <button
            onClick={handleCredentialsSignIn}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Sign In to Dashboard</span>
              </>
            )}
          </button>

          {/* Secondary: Google OAuth (only works when credentials are configured) */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs transition-colors border border-gray-700 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google OAuth</span>
          </button>

          <p className="text-[11px] text-center text-gray-500 flex items-center justify-center space-x-1 pt-1 font-mono">
            <Lock className="w-3 h-3 text-gray-500" />
            <span>NextAuth Authenticated Session</span>
          </p>
        </div>
      </div>
    </div>
  );
}
